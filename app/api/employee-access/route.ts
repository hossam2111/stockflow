import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { getWorkspaceContext, requireWorkspaceAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const context=await getWorkspaceContext();if(!context?.organizationId)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});const session=context.session;
  const id = new URL(request.url).searchParams.get("employeeId") || (session.role === "EMPLOYEE" ? session.id : "omar");
  if(session.role!=="ADMIN"&&session.id!==id)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const result = await query<{id:string;active:boolean;daily_limit:number}>("SELECT id, active, daily_limit FROM users WHERE id=$1 AND role='EMPLOYEE' AND organization_id=$2", [id,context.organizationId]);
  if (!result.rows[0]) return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
  const permissions = await query<{service_id:string;name:string;enabled:boolean;daily_limit:number}>(`SELECT p.service_id,s.name,p.enabled,p.daily_limit
    FROM employee_service_permissions p JOIN services s ON s.id=p.service_id
    WHERE p.user_id=$1 AND s.organization_id=$2 AND s.active=TRUE ORDER BY s.name`, [id,context.organizationId]);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const usage = await query<{service_id:string}>(`SELECT service_id FROM withdrawals
    WHERE user_id=$1 AND organization_id=$3 AND status='COMPLETED' AND created_at >= $2`, [id,startOfDay,context.organizationId]);
  const usageByService = usage.rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.service_id] = (counts[row.service_id] ?? 0) + 1;
    return counts;
  }, {});
  return NextResponse.json({
    employeeId: id,
    enabled: result.rows[0].active,
    dailyLimit: result.rows[0].daily_limit,
    usedToday: usage.rows.length,
    permissions: permissions.rows.map((permission) => ({ ...permission, usedToday: usageByService[permission.service_id] ?? 0 })),
  });
}

const updateSchema = z.object({ employeeId: z.string().default("omar"), enabled: z.boolean(), dailyLimit: z.number().int().min(0).max(10000).optional() });
export async function POST(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  const { employeeId, enabled, dailyLimit } = parsed.data;
  const result = await query<{id:string;active:boolean;daily_limit:number}>(`UPDATE users SET active=$2, daily_limit=COALESCE($3,daily_limit)
    WHERE id=$1 AND role='EMPLOYEE' AND organization_id=$4 RETURNING id,active,daily_limit`, [employeeId,enabled,dailyLimit??null,context.organizationId]);
  if (!result.rows[0]) return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
  await query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,$4,'USER',$5,$6)",
    [crypto.randomUUID(),context.organizationId,context.session.id,enabled?"EMPLOYEE_ENABLED":"EMPLOYEE_DISABLED",employeeId,JSON.stringify({dailyLimit})]);
  return NextResponse.json({ employeeId, enabled: result.rows[0].active, dailyLimit: result.rows[0].daily_limit });
}
