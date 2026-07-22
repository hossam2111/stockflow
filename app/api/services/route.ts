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
  const { name, defaultDailyLimit } = parsed.data;
  // A super admin defines the platform catalogue: the service is added to EVERY organization.
  // An org admin only adds it to their own workspace.
  const isSuper = context.session.isSuperAdmin;
  if (!isSuper) {
    const duplicate = await query("SELECT id FROM services WHERE organization_id=$1 AND LOWER(name)=LOWER($2)", [context.organizationId,name]);
    if (duplicate.rows[0]) return NextResponse.json({ error: "SERVICE_EXISTS" }, { status: 409 });
  }
  const targets = isSuper
    ? (await query<{ id: string }>("SELECT id FROM organizations")).rows.map((row) => row.id)
    : [context.organizationId];
  let current: { id: string; name: string; active: boolean; default_daily_limit: number } | null = null;
  for (const orgId of targets) {
    const existing = await query<{ id: string; name: string; active: boolean; default_daily_limit: number }>(
      "SELECT id,name,active,default_daily_limit FROM services WHERE organization_id=$1 AND LOWER(name)=LOWER($2)", [orgId,name]);
    if (existing.rows[0]) { if (orgId === context.organizationId) current = existing.rows[0]; continue; }
    const result = await query<{ id: string; name: string; active: boolean; default_daily_limit: number }>(
      `INSERT INTO services(id,organization_id,name,default_daily_limit) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING
       RETURNING id,name,active,default_daily_limit`, [`svc-${crypto.randomUUID().slice(0, 8)}`,orgId,name,defaultDailyLimit]);
    if (orgId === context.organizationId && result.rows[0]) current = result.rows[0];
  }
  await query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'SERVICE_CREATED','SERVICE',$4,$5)",
    [crypto.randomUUID(),context.organizationId,context.session.id,current?.id ?? name,JSON.stringify({ name, appliedToAll: isSuper, organizations: targets.length })]);
  return NextResponse.json({ service: current }, { status: 201 });
}
