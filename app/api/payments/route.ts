import { NextResponse } from "next/server";
import { transaction, query } from "@/lib/db";
import { z } from "zod";
import { requireWorkspaceAdmin } from "@/lib/auth";

const schema = z.object({
  customerPhone: z.string().trim().min(1).max(40).optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  amount: z.number().int().min(1).max(100000000),
}).refine((data) => data.customerPhone || data.customerName, { message: "CUSTOMER_REQUIRED" });

// Records a customer payment: applies `amount` against that customer's outstanding COMPLETED
// withdrawals (selling_price > paid_amount), oldest first, increasing paid_amount up to the price.
export async function POST(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const matchCol = parsed.data.customerPhone ? "customer_phone" : "customer_name";
  const matchVal = parsed.data.customerPhone ?? parsed.data.customerName;
  try {
    const result=await transaction(async client=>{
      const outstanding=await client.query<{ id: string; remaining: number }>(
        `SELECT id, (selling_price-paid_amount) AS remaining FROM withdrawals
         WHERE organization_id=$1 AND status='COMPLETED' AND ${matchCol}=$2 AND selling_price>paid_amount
         ORDER BY created_at ASC FOR UPDATE`, [context.organizationId, matchVal]);
      let left=parsed.data.amount; let applied=0;
      for(const row of outstanding.rows){
        if(left<=0)break;
        const pay=Math.min(left, row.remaining);
        await client.query("UPDATE withdrawals SET paid_amount=paid_amount+$1 WHERE id=$2",[pay,row.id]);
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
