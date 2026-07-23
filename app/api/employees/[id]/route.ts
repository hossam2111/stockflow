import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { z } from "zod";
import { getWorkspaceContext, requireWorkspacePermission } from "@/lib/auth";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const context=await getWorkspaceContext();if(!context?.organizationId)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});if(context.session.id!==id&&!(await requireWorkspacePermission("employees.manage")))return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const user=await query("SELECT id,email,name,role,team,active,daily_limit,can_manage_accounting,access_role FROM users WHERE id=$1 AND organization_id=$2",[id,context.organizationId]);
  if(!user.rows[0])return NextResponse.json({error:"EMPLOYEE_NOT_FOUND"},{status:404});
  const permissions=await query(`SELECT s.id,s.name,p.enabled,p.daily_limit FROM services s
    LEFT JOIN employee_service_permissions p ON p.service_id=s.id AND p.user_id=$1 WHERE s.organization_id=$2 ORDER BY s.created_at`,[id,context.organizationId]);
  return NextResponse.json({employee:user.rows[0],permissions:permissions.rows});
}

const schema=z.object({active:z.boolean(),dailyLimit:z.number().int().min(0).max(10000),accessRole:z.enum(["ADMIN","ACCOUNTANT","SALES","EMPLOYEE","AUDITOR"]).default("EMPLOYEE"),canManageAccounting:z.boolean().default(false),permissions:z.array(z.object({serviceId:z.string(),enabled:z.boolean(),dailyLimit:z.number().int().min(0).max(10000)}))});
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await requireWorkspacePermission("employees.manage");if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const {id}=await params; const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT",details:parsed.error.flatten()},{status:400});
  await transaction(async client=>{
    const updated=await client.query("UPDATE users SET active=$2,daily_limit=$3,can_manage_accounting=$4,access_role=$5 WHERE id=$1 AND role='EMPLOYEE' AND organization_id=$6 RETURNING id",[id,parsed.data.active,parsed.data.dailyLimit,parsed.data.accessRole==="ACCOUNTANT",parsed.data.accessRole,context.organizationId]);
    if(!updated.rows[0])throw new Error("EMPLOYEE_NOT_FOUND");
    for(const permission of parsed.data.permissions)await client.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
      VALUES($1,$2,$3,$4) ON CONFLICT(user_id,service_id) DO UPDATE SET enabled=EXCLUDED.enabled,daily_limit=EXCLUDED.daily_limit`,[id,permission.serviceId,permission.enabled,permission.dailyLimit]);
    await client.query("INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'EMPLOYEE_PERMISSIONS_UPDATED','USER',$4,$5)",[crypto.randomUUID(),context.organizationId,context.session.id,id,JSON.stringify(parsed.data)]);
  });
  return NextResponse.json({ok:true});
}
