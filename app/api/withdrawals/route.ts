import { NextResponse } from "next/server";
import { isMemoryDatabase, transaction } from "@/lib/db";
import { z } from "zod";
import { getWorkspaceContext, requireWorkspaceAdmin, requireWorkspacePermission } from "@/lib/auth";

const schema = z.object({
  employeeId:z.string().default("omar"),
  serviceId:z.string(),
  idempotencyKey:z.string().min(8).max(100),
  customerName:z.string().trim().min(2).max(120),
  customerPhone:z.string().trim().max(40).optional().default(""),
  customerContact:z.string().trim().max(60).optional().default(""),
  customerReference:z.string().trim().max(100).optional().default(""),
  customerNotes:z.string().trim().max(1000).optional().default(""),
  subscriptionStartDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subscriptionMonths:z.number().int().min(1).max(24),
  warrantyDays:z.number().int().min(0).max(730),
  quantity:z.number().int().min(1).max(20).default(1),
  sellingPrice:z.number().min(0).optional().default(0),
  paidAmount:z.number().min(0).optional(),
});

function parseDate(value:string){
  const date=new Date(`${value}T00:00:00.000Z`);
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error("INVALID_DATE");
  return date;
}

function addMonths(date:Date,months:number){
  const targetFirst=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+months,1));
  const lastDay=new Date(Date.UTC(targetFirst.getUTCFullYear(),targetFirst.getUTCMonth()+1,0)).getUTCDate();
  return new Date(Date.UTC(targetFirst.getUTCFullYear(),targetFirst.getUTCMonth(),Math.min(date.getUTCDate(),lastDay)));
}

function dateOnly(date:Date){return date.toISOString().slice(0,10);}

export async function POST(request: Request) {
  const context=await getWorkspaceContext();if(!context?.organizationId)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});const session=context.session;
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  // The withdrawal is always recorded under the logged-in account (admin or employee); there is no
  // "withdraw on behalf of another employee" picker yet, so never trust a client-supplied employeeId.
  parsed.data.employeeId=session.id;
  try {
    const subscriptionStart=parseDate(parsed.data.subscriptionStartDate);
    const subscriptionEnd=addMonths(subscriptionStart,parsed.data.subscriptionMonths);
    const warrantyEnd=parsed.data.warrantyDays>0
      ? new Date(subscriptionStart.getTime()+parsed.data.warrantyDays*24*60*60*1000)
      : null;
    const result=await transaction(async client=>{
      const existing=await client.query("SELECT id,status,inventory_item_id FROM withdrawals WHERE idempotency_key=$1",[parsed.data.idempotencyKey]);
      if(existing.rows[0])return {duplicate:true,withdrawal:existing.rows[0]};
      const startOfDay=new Date(); startOfDay.setHours(0,0,0,0);
      // Authorization by role:
      //  - super admin: absolute withdrawal — no org-membership, permission or limit checks (their user row has org=NULL).
      //  - org admin: withdraws in their own org without needing a per-service permission, bound only by their own daily limit.
      //  - employee: must have the service enabled and is bound by both the per-service and the overall daily limit.
      if(!session.isSuperAdmin){
        const userResult=await client.query("SELECT id,active,daily_limit,role FROM users WHERE id=$1 AND organization_id=$2 FOR UPDATE",[parsed.data.employeeId,context.organizationId]);
        const user=userResult.rows[0];
        if(!user)throw new Error("EMPLOYEE_NOT_FOUND");
        if(!user.active)throw new Error("EMPLOYEE_DISABLED");
        if(user.role!=="ADMIN"){
          const permissionResult=await client.query(`SELECT enabled,daily_limit FROM employee_service_permissions WHERE user_id=$1 AND service_id=$2`,[parsed.data.employeeId,parsed.data.serviceId]);
          const permission=permissionResult.rows[0];
          if(!permission?.enabled)throw new Error("SERVICE_NOT_ALLOWED");
          const serviceUsageResult=await client.query(`SELECT COUNT(*)::int AS total
            FROM withdrawals WHERE user_id=$1 AND service_id=$2 AND status='COMPLETED' AND created_at>=$3`,[parsed.data.employeeId,parsed.data.serviceId,startOfDay]);
          if(serviceUsageResult.rows[0].total+parsed.data.quantity>permission.daily_limit)throw new Error("SERVICE_LIMIT_REACHED");
        }
        const totalUsageResult=await client.query(`SELECT COUNT(*)::int AS total
          FROM withdrawals WHERE user_id=$1 AND status='COMPLETED' AND created_at>=$2`,[parsed.data.employeeId,startOfDay]);
        if(totalUsageResult.rows[0].total+parsed.data.quantity>user.daily_limit)throw new Error("DAILY_LIMIT_REACHED");
      }
      // Accounting snapshot: cost comes from the service's default cost at sale time; paid amount
      // defaults to the full selling price (i.e. paid in full) unless the caller records a partial payment.
      const serviceRow=await client.query<{default_cost:number;name:string}>("SELECT default_cost,name FROM services WHERE id=$1 AND organization_id=$2",[parsed.data.serviceId,context.organizationId]);
      const unitCost=serviceRow.rows[0]?.default_cost ?? 0;
      const unitPaid=parsed.data.paidAmount ?? parsed.data.sellingPrice;
      const lock=isMemoryDatabase()?"":"FOR UPDATE SKIP LOCKED";
      const settingsResult=await client.query<{allocation_strategy:string;allow_shared_accounts:boolean}>("SELECT allocation_strategy,allow_shared_accounts FROM organization_settings WHERE organization_id=$1",[context.organizationId]);
      const allocationOrder=settingsResult.rows[0]?.allocation_strategy==="LIFO"?"DESC":"ASC";
      const allowShared=settingsResult.rows[0]?.allow_shared_accounts??true;
      const batchId=`BATCH-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
      const allocatedIds:string[]=[];
      const withdrawalIds:string[]=[];
      const credentialMap=new Map<string,{
        inventoryId:string;email:string;password:string;otpSecret:string|null;otpUrl:string|null;
        accountType:"INDIVIDUAL"|"SHARED";allocatedUses:number;previousUsage:number;newUsage:number;
        maxUsage:number;remainingUsage:number;status:string;
        customerName:string;customerPhone:string;customerContact:string;customerReference:string;customerNotes:string;
        subscriptionStartDate:string;subscriptionMonths:number;subscriptionEndDate:string;
        warrantyDays:number;warrantyEndDate:string|null;
        sellingPrice?:number;
      }>();
      for(let index=0;index<parsed.data.quantity;index++){
        const inventoryResult=await client.query(`SELECT * FROM inventory_items WHERE organization_id=$1 AND service_id=$2
          AND status='AVAILABLE' AND current_usage<max_usage
          AND ($3::boolean=TRUE OR account_type<>'SHARED')
          ORDER BY CASE WHEN account_type='SHARED' THEN 0 ELSE 1 END, created_at ${allocationOrder} LIMIT 1 ${lock}`,
          [context.organizationId,parsed.data.serviceId,allowShared]);
        const item=inventoryResult.rows[0];if(!item)throw new Error("OUT_OF_STOCK");allocatedIds.push(item.id);
        const updated=await client.query(`UPDATE inventory_items SET current_usage=current_usage+1,status=CASE WHEN current_usage+1>=max_usage THEN 'FULL' ELSE 'AVAILABLE' END WHERE id=$1 AND current_usage<max_usage RETURNING *`,[item.id]);
        const updatedItem=updated.rows[0];if(!updatedItem)throw new Error("INVENTORY_CONFLICT");
        const withdrawalId=`WD-${crypto.randomUUID().slice(0,8).toUpperCase()}`;withdrawalIds.push(withdrawalId);
        const itemIdempotencyKey=index===0?parsed.data.idempotencyKey:`${parsed.data.idempotencyKey}:${index}`;
        await client.query(`INSERT INTO withdrawals(
          id,organization_id,user_id,service_id,inventory_item_id,status,idempotency_key,previous_usage,new_usage,batch_id,batch_quantity,
          customer_name,customer_phone,customer_contact,customer_reference,customer_notes,
          subscription_start_date,subscription_months,subscription_end_date,warranty_days,warranty_end_date,selling_price,cost,paid_amount)
          VALUES ($1,$2,$3,$4,$5,'COMPLETED',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,[
          withdrawalId,context.organizationId,parsed.data.employeeId,parsed.data.serviceId,item.id,itemIdempotencyKey,item.current_usage,item.current_usage+1,batchId,parsed.data.quantity,
          parsed.data.customerName,parsed.data.customerPhone||null,parsed.data.customerContact||null,parsed.data.customerReference||null,parsed.data.customerNotes||null,
          dateOnly(subscriptionStart),parsed.data.subscriptionMonths,dateOnly(subscriptionEnd),parsed.data.warrantyDays,warrantyEnd?dateOnly(warrantyEnd):null,
          parsed.data.sellingPrice,unitCost,unitPaid,
        ]);
        await client.query(`INSERT INTO sales(id,organization_id,withdrawal_id,created_by,source,service_name,item_description,customer_name,customer_phone,quantity,total_amount,cost_amount,paid_amount,status,notes,sold_at)
          VALUES($1,$2,$3,$4,'WITHDRAWAL',$5,$5,$6,$7,1,$8,$9,$10,'COMPLETED',$11,$12) ON CONFLICT(withdrawal_id) DO NOTHING`,[
          `SALE-${withdrawalId}`,context.organizationId,withdrawalId,parsed.data.employeeId,serviceRow.rows[0]?.name??parsed.data.serviceId,
          parsed.data.customerName,parsed.data.customerPhone||null,parsed.data.sellingPrice,unitCost,unitPaid,parsed.data.customerNotes||null,dateOnly(subscriptionStart)
        ]);
        const existingCredential=credentialMap.get(item.id);
        if(existingCredential){
          existingCredential.allocatedUses+=1;
          existingCredential.newUsage=updatedItem.current_usage;
          existingCredential.remainingUsage=Math.max(0,updatedItem.max_usage-updatedItem.current_usage);
          existingCredential.status=updatedItem.status;
        }else{
          credentialMap.set(item.id,{
            inventoryId:item.id,email:item.email,password:item.password,otpSecret:item.otp_secret,otpUrl:item.otp_url,
            accountType:item.account_type,allocatedUses:1,previousUsage:item.current_usage,newUsage:updatedItem.current_usage,
            maxUsage:item.max_usage,remainingUsage:Math.max(0,updatedItem.max_usage-updatedItem.current_usage),status:updatedItem.status,
            customerName:parsed.data.customerName,customerPhone:parsed.data.customerPhone,customerContact:parsed.data.customerContact,
            customerReference:parsed.data.customerReference,customerNotes:parsed.data.customerNotes,
            subscriptionStartDate:dateOnly(subscriptionStart),subscriptionMonths:parsed.data.subscriptionMonths,
            subscriptionEndDate:dateOnly(subscriptionEnd),warrantyDays:parsed.data.warrantyDays,
            warrantyEndDate:warrantyEnd?dateOnly(warrantyEnd):null,
            sellingPrice:parsed.data.sellingPrice,
          });
        }
      }
      const credentials=Array.from(credentialMap.values());
      await client.query(`INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,'WITHDRAWAL_BATCH','WITHDRAWAL_BATCH',$4,$5)`,
        [crypto.randomUUID(),context.organizationId,parsed.data.employeeId,batchId,JSON.stringify({serviceId:parsed.data.serviceId,inventoryItemIds:allocatedIds,quantity:parsed.data.quantity,customerName:parsed.data.customerName,subscriptionEnd:dateOnly(subscriptionEnd),warrantyEnd:warrantyEnd?dateOnly(warrantyEnd):null})]);
      return {
        duplicate:false,
        batch:{id:batchId,quantity:parsed.data.quantity,inventoryAccounts:credentials.length,withdrawalIds},credentials,
      };
    });
    return NextResponse.json(result,{status:result.duplicate?200:201});
  } catch(error) {
    const code=error instanceof Error?error.message:"WITHDRAWAL_FAILED";
    const known=["EMPLOYEE_DISABLED","EMPLOYEE_NOT_FOUND","SERVICE_NOT_ALLOWED","DAILY_LIMIT_REACHED","SERVICE_LIMIT_REACHED","OUT_OF_STOCK","INVENTORY_CONFLICT","INVALID_DATE"];
    if(!known.includes(code))console.error("[withdrawals] unexpected failure:",error);
    const status=["EMPLOYEE_DISABLED","SERVICE_NOT_ALLOWED","DAILY_LIMIT_REACHED","SERVICE_LIMIT_REACHED"].includes(code)?403:code==="OUT_OF_STOCK"?409:400;
    return NextResponse.json({error:code},{status});
  }
}

export async function GET(request:Request){
  const context=await getWorkspaceContext();if(!context?.organizationId)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});const session=context.session;
  const params=new URL(request.url).searchParams;
  const requested=params.get("employeeId");
  const from=params.get("from"); const to=params.get("to");
  const broadAccess=session.role==="ADMIN"||Boolean(await requireWorkspacePermission("reports.view"));
  const employeeId=broadAccess?requested:session.id;
  const base=`SELECT w.id,w.user_id,w.status,w.created_at,w.batch_id,w.batch_quantity,w.previous_usage,w.new_usage,
    s.name AS service,w.inventory_item_id,u.name AS employee,i.account_type,
    i.email AS account_email,i.password AS account_password,i.otp_secret,i.otp_url,
    w.customer_name,w.customer_phone,w.customer_contact,w.customer_reference,w.customer_notes,
    w.subscription_start_date,w.subscription_months,w.subscription_end_date,w.warranty_days,w.warranty_end_date,
    w.selling_price,w.cost,w.paid_amount,(w.selling_price-w.paid_amount) AS remaining
    FROM withdrawals w JOIN services s ON s.id=w.service_id JOIN users u ON u.id=w.user_id
    JOIN inventory_items i ON i.id=w.inventory_item_id`;
  const values:unknown[]=[context.organizationId];
  const filters=["w.organization_id=$1"];
  if(employeeId){values.push(employeeId);filters.push(`w.user_id=$${values.length}`);}
  if(from){values.push(from);filters.push(`w.created_at>=$${values.length}::date`);}
  if(to){values.push(to);filters.push(`w.created_at < ($${values.length}::date + INTERVAL '1 day')`);}
  const { query }=await import("@/lib/db");
  const result=await query(`${base} WHERE ${filters.join(" AND ")} ORDER BY w.created_at DESC LIMIT 2000`,values);
  return NextResponse.json({withdrawals:result.rows});
}

export async function DELETE(request:Request){
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  try {
    const returned=await transaction(async client=>{
      const withdrawalResult=await client.query("SELECT id,status,inventory_item_id FROM withdrawals WHERE id=$1 AND organization_id=$2 FOR UPDATE",[id,context.organizationId]);
      const withdrawal=withdrawalResult.rows[0];if(!withdrawal)throw new Error("NOT_FOUND");
      if(withdrawal.status!=="COMPLETED")throw new Error("ALREADY_RETURNED");
      if(withdrawal.inventory_item_id!=null){
        await client.query("SELECT id,max_usage,status FROM inventory_items WHERE id=$1 FOR UPDATE",[withdrawal.inventory_item_id]);
        await client.query("UPDATE inventory_items SET current_usage=GREATEST(0,current_usage-1),status=CASE WHEN status='DISABLED' THEN 'DISABLED' WHEN GREATEST(0,current_usage-1)>=max_usage THEN 'FULL' ELSE 'AVAILABLE' END WHERE id=$1",[withdrawal.inventory_item_id]);
      }
      await client.query("UPDATE withdrawals SET status='RETURNED' WHERE id=$1",[withdrawal.id]);
      await client.query("UPDATE sales SET status='CANCELLED',updated_at=NOW() WHERE withdrawal_id=$1",[withdrawal.id]);
      await client.query(`INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,'WITHDRAWAL_RETURN','WITHDRAWAL_BATCH',$4,$5)`,
        [crypto.randomUUID(),context.organizationId,context.session.id,withdrawal.id,JSON.stringify({inventoryItemId:withdrawal.inventory_item_id})]);
      return withdrawal.id;
    });
    return NextResponse.json({returned:returned});
  } catch(error) {
    const code=error instanceof Error?error.message:"WITHDRAWAL_RETURN_FAILED";
    const known=["NOT_FOUND","ALREADY_RETURNED"];
    if(!known.includes(code))console.error("[withdrawals] unexpected return failure:",error);
    const status=code==="NOT_FOUND"?404:code==="ALREADY_RETURNED"?409:400;
    return NextResponse.json({error:code},{status});
  }
}
