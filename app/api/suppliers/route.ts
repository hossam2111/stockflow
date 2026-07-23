import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { z } from "zod";
import { requireWorkspacePermission } from "@/lib/auth";

export async function GET() {
  const context=await requireWorkspacePermission("suppliers.manage");if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const result=await query(`SELECT s.id,s.name,s.phone,s.notes,s.created_at,
    COALESCE(SUM(p.total),0)::int AS total_purchased,
    COALESCE(SUM(p.paid),0)::int AS total_paid,
    COALESCE(SUM(p.total-p.paid),0)::int AS owed,
    COUNT(p.id)::int AS purchases
    FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.organization_id=$1
    WHERE s.organization_id=$1 GROUP BY s.id,s.name,s.phone,s.notes,s.created_at ORDER BY s.created_at DESC`,[context.organizationId]);
  return NextResponse.json({ suppliers: result.rows });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request) {
  const context=await requireWorkspacePermission("suppliers.manage");if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed=createSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const id=`sup-${crypto.randomUUID().slice(0,8)}`;
  const result=await query(`INSERT INTO suppliers(id,organization_id,name,phone,notes) VALUES ($1,$2,$3,$4,$5)
    RETURNING id,name,phone,notes,created_at`,[id,context.organizationId,parsed.data.name,parsed.data.phone||null,parsed.data.notes||null]);
  return NextResponse.json({ supplier: result.rows[0] }, { status: 201 });
}

// Pay a supplier: distributes `pay` across their purchases with an outstanding balance, oldest first.
export async function PATCH(request: Request) {
  const context=await requireWorkspacePermission("suppliers.manage");if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const parsed=z.object({ pay: z.number().int().min(1).max(1000000000) }).safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const result=await transaction(async client=>{
      const owner=await client.query("SELECT id FROM suppliers WHERE id=$1 AND organization_id=$2",[id,context.organizationId]);
      if(!owner.rows[0])throw new Error("NOT_FOUND");
      const outstanding=await client.query<{ id: string; remaining: number }>(
        `SELECT id,(total-paid) AS remaining FROM purchases WHERE supplier_id=$1 AND organization_id=$2 AND total>paid
         ORDER BY purchased_at ASC, created_at ASC FOR UPDATE`,[id,context.organizationId]);
      let left=parsed.data.pay, applied=0;
      for(const row of outstanding.rows){ if(left<=0)break; const pay=Math.min(left,row.remaining); await client.query("UPDATE purchases SET paid=paid+$1 WHERE id=$2",[pay,row.id]); left-=pay; applied+=pay; }
      if(applied===0)throw new Error("NO_OUTSTANDING");
      return { applied, unallocated: left };
    });
    return NextResponse.json(result);
  } catch(error) {
    const code=error instanceof Error?error.message:"PAY_FAILED";
    return NextResponse.json({ error: code }, { status: code==="NOT_FOUND"?404:code==="NO_OUTSTANDING"?409:400 });
  }
}

export async function DELETE(request: Request) {
  const context=await requireWorkspacePermission("suppliers.manage");if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  // purchases are removed via ON DELETE CASCADE
  const result=await query("DELETE FROM suppliers WHERE id=$1 AND organization_id=$2 RETURNING id",[id,context.organizationId]);
  if(!result.rows[0])return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
