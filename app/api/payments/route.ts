import { NextResponse } from "next/server";
import { transaction, query } from "@/lib/db";
import { z } from "zod";
import { requireWorkspacePermission } from "@/lib/auth";

const schema = z.object({
  customerPhone: z.string().trim().min(1).max(40).optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  amount: z.number().int().min(1).max(100000000),
}).refine((data) => data.customerPhone || data.customerName, { message: "CUSTOMER_REQUIRED" });

// Records a customer payment: applies `amount` against that customer's outstanding COMPLETED
// withdrawals (selling_price > paid_amount), oldest first, increasing paid_amount up to the price.
export async function POST(request: Request) {
  const context=await requireWorkspacePermission("accounting.manage");if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const matchCol = parsed.data.customerPhone ? "customer_phone" : "customer_name";
  const matchVal = parsed.data.customerPhone ?? parsed.data.customerName;
  try {
    const result=await transaction(async client=>{
      const outstanding=await client.query<{ id: string; remaining: number }>(
        `SELECT id, withdrawal_id, (total_amount-paid_amount) AS remaining FROM sales
         WHERE organization_id=$1 AND status<>'CANCELLED' AND ${matchCol}=$2 AND total_amount>paid_amount
         ORDER BY sold_at ASC,created_at ASC FOR UPDATE`, [context.organizationId, matchVal]);
      let left=parsed.data.amount; let applied=0;
      for(const row of outstanding.rows){
        if(left<=0)break;
        const pay=Math.min(left, row.remaining);
        await client.query("UPDATE sales SET paid_amount=paid_amount+$1,updated_at=NOW() WHERE id=$2",[pay,row.id]);
        const sale=await client.query<{withdrawal_id:string|null}>("SELECT withdrawal_id FROM sales WHERE id=$1",[row.id]);
        if(sale.rows[0]?.withdrawal_id)await client.query("UPDATE withdrawals SET paid_amount=LEAST(selling_price,paid_amount+$1) WHERE id=$2",[pay,sale.rows[0].withdrawal_id]);
        left-=pay; applied+=pay;
      }
      if(applied===0)throw new Error("NO_OUTSTANDING");
      return { applied, unallocated: left };
    });
    await query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'PAYMENT_RECEIVED','PAYMENT',$4,$5)",
      [crypto.randomUUID(),context.organizationId,context.session.id,matchVal,JSON.stringify({ applied: result.applied })]);
    return NextResponse.json(result);
  } catch(error) {
    const code=error instanceof Error?error.message:"PAYMENT_FAILED";
    return NextResponse.json({ error: code }, { status: code==="NO_OUTSTANDING"?409:400 });
  }
}
