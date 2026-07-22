import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { requireWorkspaceAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const params=new URL(request.url).searchParams; const from=params.get("from"); const to=params.get("to");
  const values:unknown[]=[context.organizationId]; const filters=["organization_id=$1"];
  if(from){values.push(from);filters.push(`paid_at>=$${values.length}::date`);}
  if(to){values.push(to);filters.push(`paid_at<=$${values.length}::date`);}
  const [list,total]=await Promise.all([
    query(`SELECT id,name,role,amount,paid_at,notes,created_at FROM wages WHERE ${filters.join(" AND ")} ORDER BY paid_at DESC, created_at DESC LIMIT 1000`, values),
    query(`SELECT COALESCE(SUM(amount),0)::int AS total FROM wages WHERE ${filters.join(" AND ")}`, values),
  ]);
  return NextResponse.json({ wages: list.rows, total: (total.rows[0] as { total: number }).total });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.string().trim().max(60).optional().default(""),
  amount: z.number().int().min(1).max(1000000000),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed=createSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const id=`wage-${crypto.randomUUID().slice(0,8)}`;
  const result=await query(`INSERT INTO wages(id,organization_id,name,role,amount,paid_at,notes)
    VALUES ($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE),$7) RETURNING id,name,role,amount,paid_at,notes,created_at`,
    [id,context.organizationId,parsed.data.name,parsed.data.role||null,parsed.data.amount,parsed.data.paidAt ?? null,parsed.data.notes||null]);
  return NextResponse.json({ wage: result.rows[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result=await query("DELETE FROM wages WHERE id=$1 AND organization_id=$2 RETURNING id",[id,context.organizationId]);
  if(!result.rows[0])return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
