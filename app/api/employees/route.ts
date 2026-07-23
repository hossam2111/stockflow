import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireWorkspacePermission } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET() {
  const context=await requireWorkspacePermission("employees.manage");if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  // Two aggregate queries instead of two per employee (was N+1 — noticeably slow once an org has more
  // than a handful of employees, since every extra round trip to Postgres adds real network latency).
  const [users, permissionRows] = await Promise.all([
    query<{id:string;email:string;name:string;team:string;active:boolean;daily_limit:number;can_manage_accounting:boolean;access_role:string;created_at:string;today:number;month:number}>(
      `SELECT u.id,u.email,u.name,u.team,u.active,u.daily_limit,u.can_manage_accounting,u.access_role,u.created_at,
        COUNT(w.id) FILTER (WHERE w.created_at>=$2 AND w.status='COMPLETED')::int AS today,
        COUNT(w.id) FILTER (WHERE w.created_at>=$3 AND w.status='COMPLETED')::int AS month
      FROM users u LEFT JOIN withdrawals w ON w.user_id=u.id AND w.organization_id=$1
      WHERE u.role='EMPLOYEE' AND u.organization_id=$1
      GROUP BY u.id,u.email,u.name,u.team,u.active,u.daily_limit,u.can_manage_accounting,u.access_role,u.created_at
      ORDER BY u.created_at ASC, u.id ASC`, [context.organizationId,startOfDay,startOfMonth]),
    query<{user_id:string;id:string;name:string;enabled:boolean;daily_limit:number}>(
      `SELECT u.id AS user_id,s.id,s.name,COALESCE(p.enabled,FALSE) AS enabled,COALESCE(p.daily_limit,s.default_daily_limit) AS daily_limit
      FROM users u CROSS JOIN services s LEFT JOIN employee_service_permissions p ON p.service_id=s.id AND p.user_id=u.id
      WHERE u.role='EMPLOYEE' AND u.organization_id=$1 AND s.organization_id=$1
      ORDER BY s.created_at`, [context.organizationId]),
  ]);
  const permissionsByUser = new Map<string, { id: string; name: string; enabled: boolean; daily_limit: number }[]>();
  for (const { user_id, ...permission } of permissionRows.rows) {
    const list = permissionsByUser.get(user_id) ?? [];
    list.push(permission);
    permissionsByUser.set(user_id, list);
  }
  const employees = users.rows.map((user) => ({ ...user, permissions: permissionsByUser.get(user.id) ?? [] }));
  return NextResponse.json({ employees });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  team: z.string().trim().min(2).max(80),
  dailyLimit: z.number().int().min(0).max(10000),
});

export async function POST(request: Request) {
  const context=await requireWorkspacePermission("employees.manage");if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  const organization=await query<{employee_limit:number}>("SELECT employee_limit FROM organizations WHERE id=$1",[context.organizationId]);
  const employeeCount=await query<{total:number}>("SELECT COUNT(*)::int AS total FROM users WHERE organization_id=$1 AND role='EMPLOYEE'",[context.organizationId]);
  if(!organization.rows[0]||(employeeCount.rows[0]?.total??0)>=organization.rows[0].employee_limit)return NextResponse.json({error:"EMPLOYEE_LIMIT_REACHED"},{status:403});
  const duplicate = await query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)", [parsed.data.email]);
  if (duplicate.rows[0]) return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
  const id = `emp-${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await transaction(async (client) => {
    await client.query(`INSERT INTO users(id,email,password_hash,name,role,organization_id,is_super_admin,team,active,daily_limit,access_role)
      VALUES($1,$2,$3,$4,'EMPLOYEE',$5,FALSE,$6,TRUE,$7,'EMPLOYEE')`, [id,parsed.data.email.toLowerCase(),passwordHash,parsed.data.name,context.organizationId,parsed.data.team,parsed.data.dailyLimit]);
    const services = await client.query("SELECT id,default_daily_limit FROM services WHERE active=TRUE AND organization_id=$1",[context.organizationId]);
    for (const service of services.rows) await client.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
      VALUES($1,$2,TRUE,$3)`, [id, service.id, service.default_daily_limit]);
    await client.query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'EMPLOYEE_CREATED','USER',$4,$5)",
      [crypto.randomUUID(),context.organizationId,context.session.id,id,JSON.stringify({ name: parsed.data.name, email: parsed.data.email })]);
  });
  return NextResponse.json({ id }, { status: 201 });
}
