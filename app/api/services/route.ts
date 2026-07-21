import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkspaceContext, requireWorkspaceAdmin } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  const context=await getWorkspaceContext();if(!context?.organizationId)return NextResponse.json({error:"NO_WORKSPACE"},{status:403});
  const result = await query(`SELECT s.id,s.name,s.active,s.default_daily_limit,
    COUNT(i.id)::int AS total,
    COALESCE(SUM(CASE WHEN i.status='AVAILABLE' AND i.current_usage<i.max_usage THEN 1 ELSE 0 END),0)::int AS available,
    COALESCE(SUM(CASE WHEN i.status='AVAILABLE' AND i.current_usage<i.max_usage THEN i.max_usage-i.current_usage ELSE 0 END),0)::int AS available_slots,
    COALESCE(SUM(CASE WHEN i.account_type='SHARED' AND i.status='AVAILABLE' AND i.current_usage<i.max_usage THEN i.max_usage-i.current_usage ELSE 0 END),0)::int AS available_shared_slots,
    COALESCE(SUM(CASE WHEN i.account_type='INDIVIDUAL' AND i.status='AVAILABLE' AND i.current_usage<i.max_usage THEN 1 ELSE 0 END),0)::int AS available_individual_accounts,
    COALESCE(SUM(CASE WHEN i.id IS NOT NULL THEN i.max_usage ELSE 0 END),0)::int AS total_capacity,
    COALESCE(SUM(CASE WHEN i.id IS NOT NULL THEN i.current_usage ELSE 0 END),0)::int AS used_slots,
    COALESCE(SUM(CASE WHEN i.account_type='SHARED' THEN 1 ELSE 0 END),0)::int AS shared_accounts
    FROM services s LEFT JOIN inventory_items i ON i.service_id=s.id AND i.organization_id=$1
    WHERE s.organization_id=$1 GROUP BY s.id,s.name,s.active,s.default_daily_limit,s.created_at ORDER BY s.created_at`,[context.organizationId]);
  return NextResponse.json({ services: result.rows });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  defaultDailyLimit: z.number().int().min(0).max(10000).default(5),
});

export async function POST(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  const duplicate = await query("SELECT id FROM services WHERE organization_id=$1 AND LOWER(name)=LOWER($2)", [context.organizationId,parsed.data.name]);
  if (duplicate.rows[0]) return NextResponse.json({ error: "SERVICE_EXISTS" }, { status: 409 });
  const id = `svc-${crypto.randomUUID().slice(0, 8)}`;
  const result = await query(`INSERT INTO services(id,organization_id,name,default_daily_limit) VALUES($1,$2,$3,$4)
    RETURNING id,name,active,default_daily_limit`, [id,context.organizationId,parsed.data.name,parsed.data.defaultDailyLimit]);
  await query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'SERVICE_CREATED','SERVICE',$4,$5)",
    [crypto.randomUUID(),context.organizationId,context.session.id,id,JSON.stringify({ name: parsed.data.name })]);
  return NextResponse.json({ service: result.rows[0] }, { status: 201 });
}
