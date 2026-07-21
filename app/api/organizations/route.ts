import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema=z.object({
  name:z.string().trim().min(2).max(120),slug:z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,50}$/),
  adminName:z.string().trim().min(2).max(120),adminEmail:z.string().email(),adminPassword:z.string().min(6).max(100),
  employeeLimit:z.number().int().min(1).max(10000).default(25),inventoryLimit:z.number().int().min(1).max(10000000).default(10000),
  plan:z.enum(["STARTER","PRO","BUSINESS"]).default("PRO"),
});

async function requireSuper(){const session=await requireSession("ADMIN");return session?.isSuperAdmin?session:null;}

export async function GET(){
  if(!await requireSuper())return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const result=await query("SELECT * FROM organizations ORDER BY created_at DESC");
  const organizations=[];
  for(const organization of result.rows){
    const employees=await query("SELECT COUNT(*)::int AS total FROM users WHERE organization_id=$1 AND role='EMPLOYEE'",[organization.id]);
    const inventory=await query("SELECT COUNT(*)::int AS total FROM inventory_items WHERE organization_id=$1",[organization.id]);
    const withdrawals=await query("SELECT COUNT(*)::int AS total FROM withdrawals WHERE organization_id=$1",[organization.id]);
    const admin=await query("SELECT email FROM users WHERE organization_id=$1 AND role='ADMIN' ORDER BY created_at ASC LIMIT 1",[organization.id]);
    organizations.push({...organization,employees:employees.rows[0]?.total??0,inventory:inventory.rows[0]?.total??0,withdrawals:withdrawals.rows[0]?.total??0,admin_email:admin.rows[0]?.email??"—"});
  }
  return NextResponse.json({organizations});
}

export async function POST(request:Request){
  const session=await requireSuper();if(!session)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const parsed=createSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  const data=parsed.data;const orgId=`org-${crypto.randomUUID().slice(0,8)}`;const adminId=`admin-${crypto.randomUUID().slice(0,8)}`;
  try{
    await transaction(async client=>{
      const passwordHash=await bcrypt.hash(data.adminPassword,10);
      await client.query(`INSERT INTO organizations(id,name,slug,employee_limit,inventory_limit,plan) VALUES ($1,$2,$3,$4,$5,$6)`,[orgId,data.name,data.slug,data.employeeLimit,data.inventoryLimit,data.plan]);
      await client.query(`INSERT INTO users(id,email,password_hash,name,role,organization_id,is_super_admin,team,active,daily_limit)
        VALUES ($1,$2,$3,$4,'ADMIN',$5,FALSE,'الإدارة',TRUE,999)`,[adminId,data.adminEmail.toLowerCase(),passwordHash,data.adminName,orgId]);
      const defaults=[["ChatGPT Plus",10],["Adobe CC",5],["Canva Pro",4],["Claude Pro",4],["Perplexity",4],["Midjourney",3]];
      for(const [name,limit] of defaults)await client.query(`INSERT INTO services(id,organization_id,name,default_daily_limit) VALUES ($1,$2,$3,$4)`,[`svc-${crypto.randomUUID().slice(0,8)}`,orgId,name,limit]);
      await client.query(`INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,$3,'ORGANIZATION_CREATED','ORGANIZATION',$2,$4)`,[crypto.randomUUID(),orgId,session.id,JSON.stringify({name:data.name,adminEmail:data.adminEmail})]);
    });
    return NextResponse.json({organization:{id:orgId,name:data.name,slug:data.slug,adminEmail:data.adminEmail}},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:"";
    return NextResponse.json({error:message.toLowerCase().includes("unique")?"DUPLICATE_ORGANIZATION_OR_EMAIL":"CREATE_FAILED"},{status:409});
  }
}

const updateSchema=z.object({id:z.string(),active:z.boolean()});
export async function PATCH(request:Request){
  if(!await requireSuper())return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const parsed=updateSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  const result=await query("UPDATE organizations SET active=$2 WHERE id=$1 RETURNING id,name,active",[parsed.data.id,parsed.data.active]);
  if(!result.rows[0])return NextResponse.json({error:"NOT_FOUND"},{status:404});
  await query("UPDATE users SET active=$2 WHERE organization_id=$1",[parsed.data.id,parsed.data.active]);
  return NextResponse.json({organization:result.rows[0]});
}
