import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { z } from "zod";
import { requireWorkspacePermission } from "@/lib/auth";

const itemSchema = z.object({
  serviceId: z.string().min(1), email: z.string().email(), password: z.string().min(1),
  otpSecret: z.string().optional().nullable(), otpUrl: z.string().url().optional().nullable(),
  accountType: z.enum(["INDIVIDUAL","SHARED"]), maxUsage: z.number().int().min(1).max(100).default(1),
});

export async function GET(request: Request) {
  const context=await requireWorkspacePermission("inventory.view");if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const url = new URL(request.url); const serviceId = url.searchParams.get("serviceId"); const search = url.searchParams.get("search") || "";
  const values: unknown[] = [context.organizationId];
  const filters = ["i.organization_id=$1"];
  if (serviceId) {
    values.push(serviceId);
    filters.push(`i.service_id=$${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(LOWER(i.email) LIKE LOWER($${values.length}) OR LOWER(i.id) LIKE LOWER($${values.length}))`);
  }
  const result = await query(`SELECT i.id,i.service_id,s.name AS service,i.email,i.password,i.otp_secret,i.otp_url,
    i.account_type,i.max_usage,i.current_usage,i.status,i.expiry_date,i.created_at,
    (i.otp_secret IS NOT NULL) AS otp_ready FROM inventory_items i JOIN services s ON s.id=i.service_id
    WHERE ${filters.join(" AND ")}
    ORDER BY i.created_at DESC LIMIT 200`, values);
  return NextResponse.json({ items: result.rows });
}

export async function POST(request: Request) {
  const context=await requireWorkspacePermission("inventory.manage");if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body = await request.json(); const rows = z.array(itemSchema).min(1).max(10000).safeParse(body.items);
  if (!rows.success) return NextResponse.json({ error:"INVALID_ITEMS", details:rows.error.flatten() }, { status:400 });
  const organization=await query<{inventory_limit:number}>("SELECT inventory_limit FROM organizations WHERE id=$1",[context.organizationId]);
  const inventoryCount=await query<{total:number}>("SELECT COUNT(*)::int AS total FROM inventory_items WHERE organization_id=$1",[context.organizationId]);
  const remaining=Math.max(0,(organization.rows[0]?.inventory_limit??0)-(inventoryCount.rows[0]?.total??0));
  if(remaining<=0)return NextResponse.json({error:"INVENTORY_LIMIT_REACHED"},{status:403});
  const acceptedRows=rows.data.slice(0,remaining);
  let inserted=0, duplicates=0;
  for (const item of acceptedRows) {
    const service=await query<{id:string;requires_otp:boolean}>("SELECT id,requires_otp FROM services WHERE id=$1 AND organization_id=$2",[item.serviceId,context.organizationId]);
    if(!service.rows[0])continue;
    if(service.rows[0].requires_otp&&!item.otpSecret)return NextResponse.json({error:"OTP_REQUIRED",serviceId:item.serviceId},{status:400});
    const existing=await query("SELECT id FROM inventory_items WHERE organization_id=$1 AND service_id=$2 AND LOWER(email)=LOWER($3) LIMIT 1",[context.organizationId,item.serviceId,item.email]);
    if(existing.rows[0]){duplicates++;continue;}
    const result = await query(`INSERT INTO inventory_items(id,organization_id,service_id,email,password,otp_secret,otp_url,account_type,max_usage)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (service_id,email) DO NOTHING RETURNING id`,
      [`STK-${crypto.randomUUID().slice(0,8).toUpperCase()}`,context.organizationId,item.serviceId,item.email,item.password,item.otpSecret,item.otpUrl,item.accountType,item.accountType==="INDIVIDUAL"?1:item.maxUsage]);
    if (result.rowCount) inserted++;
    else duplicates++;
  }
  await query(`INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata)
    VALUES ($1,$2,$3,'INVENTORY_IMPORT','INVENTORY',$4,$5)`, [
    crypto.randomUUID(),context.organizationId,context.session.id,rows.data[0].serviceId,
    JSON.stringify({ requested: rows.data.length,accepted:acceptedRows.length,inserted,duplicates }),
  ]);
  return NextResponse.json({ inserted, duplicates }, { status:201 });
}

const patchSchema = z.object({
  password: z.string().min(1).optional(), otpSecret: z.string().optional().nullable(), otpUrl: z.string().url().optional().nullable(),
  maxUsage: z.number().int().min(1).max(100).optional(), accountType: z.enum(["INDIVIDUAL","SHARED"]).optional(),
  status: z.enum(["AVAILABLE","DISABLED"]).optional(), expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export async function PATCH(request: Request) {
  const context=await requireWorkspacePermission("inventory.manage");if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  const body=await request.json().catch(()=>({}));const parsed=patchSchema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT",details:parsed.error.flatten()},{status:400});
  const data=parsed.data;
  if(Object.values(data).every(v=>v===undefined))return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  try {
    const item=await transaction(async client=>{
      const current=await client.query<{max_usage:number;current_usage:number;status:string}>("SELECT * FROM inventory_items WHERE id=$1 AND organization_id=$2 FOR UPDATE",[id,context.organizationId]);
      if(!current.rows[0])throw new Error("NOT_FOUND");
      const row=current.rows[0];
      let effectiveMax=data.maxUsage??row.max_usage;
      if(data.accountType==="INDIVIDUAL")effectiveMax=1;
      let newStatus=row.status;
      if(data.status==="DISABLED")newStatus="DISABLED";
      else if(data.status==="AVAILABLE")newStatus=row.current_usage>=effectiveMax?"FULL":"AVAILABLE";
      else if(data.maxUsage!==undefined&&row.status!=="DISABLED")newStatus=row.current_usage>=effectiveMax?"FULL":"AVAILABLE";
      const sets:string[]=[];const vals:unknown[]=[];const changed:Record<string,unknown>={};
      const push=(col:string,val:unknown)=>{vals.push(val);sets.push(`${col}=$${vals.length}`);};
      if(data.password!==undefined){push("password",data.password);changed.password=true;}
      if(data.otpSecret!==undefined){push("otp_secret",data.otpSecret);changed.otpSecret=data.otpSecret;}
      if(data.otpUrl!==undefined){push("otp_url",data.otpUrl);changed.otpUrl=data.otpUrl;}
      if(data.accountType!==undefined){push("account_type",data.accountType);changed.accountType=data.accountType;}
      if(data.maxUsage!==undefined||data.accountType!==undefined){push("max_usage",effectiveMax);changed.maxUsage=effectiveMax;}
      if(data.expiryDate!==undefined){push("expiry_date",data.expiryDate);changed.expiryDate=data.expiryDate;}
      if(data.status!==undefined||(data.maxUsage!==undefined&&row.status!=="DISABLED")){push("status",newStatus);changed.status=newStatus;}
      vals.push(id);const idIdx=vals.length;vals.push(context.organizationId);const orgIdx=vals.length;
      const updated=await client.query(`UPDATE inventory_items SET ${sets.join(",")} WHERE id=$${idIdx} AND organization_id=$${orgIdx} RETURNING *`,vals);
      await client.query(`INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata)
        VALUES ($1,$2,$3,'INVENTORY_UPDATE','INVENTORY',$4,$5)`,[crypto.randomUUID(),context.organizationId,context.session.id,id,JSON.stringify(changed)]);
      return updated.rows[0];
    });
    return NextResponse.json({item});
  } catch(error) {
    const code=error instanceof Error?error.message:"UPDATE_FAILED";
    const status=code==="NOT_FOUND"?404:400;
    return NextResponse.json({error:code},{status});
  }
}

export async function DELETE(request: Request) {
  // requireWorkspaceAdmin resolves to the caller's own organization for an org admin, or to the
  // super admin's currently selected organization. Scoping every query to context.organizationId is
  // what enforces the hierarchy: an org admin can only ever touch their own workspace's inventory,
  // while the super admin manages whichever organization they have switched into.
  const context=await requireWorkspacePermission("inventory.manage");if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  try {
    const result=await transaction(async client=>{
      const item=await client.query("SELECT id FROM inventory_items WHERE id=$1 AND organization_id=$2 FOR UPDATE",[id,context.organizationId]);
      if(!item.rows[0])throw new Error("NOT_FOUND");
      const used=await client.query("SELECT 1 FROM withdrawals WHERE inventory_item_id=$1 LIMIT 1",[id]);
      if(used.rows[0])throw new Error("ITEM_HAS_HISTORY");
      await client.query("DELETE FROM inventory_items WHERE id=$1 AND organization_id=$2",[id,context.organizationId]);
      await client.query(`INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata)
        VALUES ($1,$2,$3,'INVENTORY_DELETE','INVENTORY',$4,'{}')`,[crypto.randomUUID(),context.organizationId,context.session.id,id]);
      return id;
    });
    return NextResponse.json({deleted:result});
  } catch(error) {
    const code=error instanceof Error?error.message:"DELETE_FAILED";
    const status=code==="NOT_FOUND"?404:code==="ITEM_HAS_HISTORY"?409:400;
    return NextResponse.json({error:code},{status});
  }
}
