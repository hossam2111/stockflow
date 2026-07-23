import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { requireWorkspaceAccounting } from "@/lib/auth";

export async function GET(request: Request) {
  const context=await requireWorkspaceAccounting();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const params=new URL(request.url).searchParams; const from=params.get("from"); const to=params.get("to");
  const values:unknown[]=[context.organizationId]; const filters=["organization_id=$1"];
  if(from){values.push(from);filters.push(`spent_at>=$${values.length}::date`);}
  if(to){values.push(to);filters.push(`spent_at<=$${values.length}::date`);}
  const result=await query(`SELECT id,description,category,amount,spent_at,created_at FROM expenses
    WHERE ${filters.join(" AND ")} ORDER BY spent_at DESC, created_at DESC LIMIT 1000`, values);
  return NextResponse.json({ expenses: result.rows });
}

const createSchema = z.object({
  description: z.string().trim().min(2).max(200),
  amount: z.number().int().min(1).max(100000000),
  category: z.string().trim().max(40).optional().default("GENERAL"),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  const context=await requireWorkspaceAccounting();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed=createSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  const id=`exp-${crypto.randomUUID().slice(0,8)}`;
  const result=await query(`INSERT INTO expenses(id,organization_id,actor_id,description,category,amount,spent_at)
    VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE)) RETURNING id,description,category,amount,spent_at,created_at`,
    [id,context.organizationId,context.session.id,parsed.data.description,parsed.data.category,parsed.data.amount,parsed.data.spentAt ?? null]);
  await query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'EXPENSE_ADDED','EXPENSE',$4,$5)",
    [crypto.randomUUID(),context.organizationId,context.session.id,id,JSON.stringify({ amount: parsed.data.amount, description: parsed.data.description })]);
  return NextResponse.json({ expense: result.rows[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const context=await requireWorkspaceAccounting();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result=await query("DELETE FROM expenses WHERE id=$1 AND organization_id=$2 RETURNING id",[id,context.organizationId]);
  if(!result.rows[0])return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
