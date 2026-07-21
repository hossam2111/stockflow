import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET() {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const users = await query(`SELECT id,email,name,team,active,daily_limit,created_at FROM users
    WHERE role='EMPLOYEE' AND organization_id=$1 ORDER BY created_at ASC`,[context.organizationId]);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const employees = [];
  for (const user of users.rows) {
    const usage = await query(`SELECT COUNT(*) FILTER (WHERE created_at >= $2)::int AS today,
      COUNT(*) FILTER (WHERE created_at >= $3)::int AS month FROM withdrawals
      WHERE user_id=$1 AND organization_id=$4 AND status='COMPLETED'`, [user.id,startOfDay,startOfMonth,context.organizationId]);
    const permissions = await query(`SELECT s.id,s.name,COALESCE(p.enabled,FALSE) AS enabled,
      COALESCE(p.daily_limit,s.default_daily_limit) AS daily_limit FROM services s
      LEFT JOIN employee_service_permissions p ON p.service_id=s.id AND p.user_id=$1
      WHERE s.organization_id=$2 ORDER BY s.created_at`, [user.id,context.organizationId]);
    employees.push({ ...user, today: usage.rows[0]?.today ?? 0, month: usage.rows[0]?.month ?? 0, permissions: permissions.rows });
  }
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
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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
    await client.query(`INSERT INTO users(id,email,password_hash,name,role,organization_id,is_super_admin,team,active,daily_limit)
      VALUES($1,$2,$3,$4,'EMPLOYEE',$5,FALSE,$6,TRUE,$7)`, [id,parsed.data.email.toLowerCase(),passwordHash,parsed.data.name,context.organizationId,parsed.data.team,parsed.data.dailyLimit]);
    const services = await client.query("SELECT id,default_daily_limit FROM services WHERE active=TRUE AND organization_id=$1",[context.organizationId]);
    for (const service of services.rows) await client.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
      VALUES($1,$2,TRUE,$3)`, [id, service.id, service.default_daily_limit]);
    await client.query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'EMPLOYEE_CREATED','USER',$4,$5)",
      [crypto.randomUUID(),context.organizationId,context.session.id,id,JSON.stringify({ name: parsed.data.name, email: parsed.data.email })]);
  });
  return NextResponse.json({ id }, { status: 201 });
}
