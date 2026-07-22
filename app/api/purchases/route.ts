import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { requireWorkspaceAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const params=new URL(request.url).searchParams; const supplierId=params.get("supplierId"); const from=params.get("from"); const to=params.get("to");
  const values:unknown[]=[context.organizationId]; const filters=["p.organization_id=$1"];
  if(supplierId){values.push(supplierId);filters.push(`p.supplier_id=$${values.length}`);}
  if(from){values.push(from);filters.push(`p.purchased_at>=$${values.length}::date`);}
  if(to){values.push(to);filters.push(`p.purchased_at<=$${values.length}::date`);}
  const result=await query(`SELECT p.id,p.supplier_id,s.name AS supplier,p.item,p.quantity,p.unit_cost,p.total,p.paid,
    (p.total-p.paid) AS remaining,p.purchased_at,p.notes,p.created_at
    FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
    WHERE ${filters.join(" AND ")} ORDER BY p.purchased_at DESC, p.created_at DESC LIMIT 1000`, values);
  return NextResponse.json({ purchases: result.rows });
}

const createSchema = z.object({
  supplierId: z.string().min(1),
  item: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(1).max(1000000),
  unitCost: z.number().int().min(0).max(10000000),
  paid: z.number().int().min(0).max(1000000000).optional(),
  purchasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed=createSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const owner=await query("SELECT id FROM suppliers WHERE id=$1 AND organization_id=$2",[parsed.data.supplierId,context.organizationId]);
  if(!owner.rows[0])return NextResponse.json({ error: "SUPPLIER_NOT_FOUND" }, { status: 404 });
  const total=parsed.data.quantity*parsed.data.unitCost;
  const paid=Math.min(parsed.data.paid ?? total, total); // default: paid in full
  const id=`pur-${crypto.randomUUID().slice(0,8)}`;
  const result=await query(`INSERT INTO purchases(id,organization_id,supplier_id,item,quantity,unit_cost,total,paid,purchased_at,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::date,CURRENT_DATE),$10)
    RETURNING id,supplier_id,item,quantity,unit_cost,total,paid,(total-paid) AS remaining,purchased_at,notes,created_at`,
    [id,context.organizationId,parsed.data.supplierId,parsed.data.item,parsed.data.quantity,parsed.data.unitCost,total,paid,parsed.data.purchasedAt ?? null,parsed.data.notes||null]);
  return NextResponse.json({ purchase: result.rows[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result=await query("DELETE FROM purchases WHERE id=$1 AND organization_id=$2 RETURNING id",[id,context.organizationId]);
  if(!result.rows[0])return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
