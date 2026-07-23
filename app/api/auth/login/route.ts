import { NextResponse } from "next/server";
import { directQuery, ensureDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { cookies } from "next/headers";

const schema=z.object({email:z.string().email(),password:z.string().min(1)});
const MAX_ATTEMPTS=5;const WINDOW_MINUTES=15;
export async function POST(request:Request){
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"INVALID_CREDENTIALS"},{status:401});
  const email=parsed.data.email.toLowerCase();
  const run=async<T extends import("pg").QueryResultRow>(text:string,values:unknown[]=[])=>{try{return await directQuery<T>(text,values);}catch(error){if((error as {code?:string}).code!=="42P01")throw error;await ensureDb();return directQuery<T>(text,values);}};
  // Brute-force guard: block further attempts once too many failed logins for this email happen in
  // a short window. Checked (and counted) before touching bcrypt so repeated guesses stay cheap to reject.
  const recentFailures=await run<{total:number}>(
    `SELECT COUNT(*)::int AS total FROM login_attempts WHERE email=$1 AND success=FALSE AND created_at>=NOW()-INTERVAL '${WINDOW_MINUTES} minutes'`,
    [email]);
  if((recentFailures.rows[0]?.total??0)>=MAX_ATTEMPTS)return NextResponse.json({error:"TOO_MANY_ATTEMPTS"},{status:429});
  const result=await run<{id:string;email:string;password_hash:string;name:string;role:"ADMIN"|"EMPLOYEE";active:boolean;team:string;organization_id:string|null;is_super_admin:boolean}>("SELECT id,email,password_hash,name,role,active,team,organization_id,is_super_admin FROM users WHERE LOWER(email)=LOWER($1)",[email]);
  const user=result.rows[0];
  const valid=user?await bcrypt.compare(parsed.data.password,user.password_hash):false;
  if(!valid){
    await run("INSERT INTO login_attempts(email,success) VALUES($1,FALSE)",[email]).catch(()=>{});
    // Opportunistically prune old rows so the table doesn't grow forever; cheap, low-probability, no extra round trip on most requests.
    if(Math.random()<0.02)await run("DELETE FROM login_attempts WHERE created_at<NOW()-INTERVAL '1 day'").catch(()=>{});
    return NextResponse.json({error:"INVALID_CREDENTIALS"},{status:401});
  }
  await run("INSERT INTO login_attempts(email,success) VALUES($1,TRUE)",[email]).catch(()=>{});
  if(user.role==="ADMIN"&&!user.is_super_admin&&!user.active)return NextResponse.json({error:"ORGANIZATION_DISABLED"},{status:403});
  const settings=user.organization_id?await run<{session_timeout_minutes:number}>("SELECT session_timeout_minutes FROM organization_settings WHERE organization_id=$1",[user.organization_id]):null;
  await createSession({id:user.id,email:user.email,name:user.name,role:user.role,organizationId:user.organization_id,isSuperAdmin:user.is_super_admin},settings?.rows[0]?.session_timeout_minutes??480);
  let selectedOrganizationId=user.organization_id;
  if(user.is_super_admin){
    const firstOrg=await run<{id:string}>("SELECT id FROM organizations WHERE active=TRUE ORDER BY created_at ASC LIMIT 1");
    if(firstOrg.rows[0]){selectedOrganizationId=firstOrg.rows[0].id;(await cookies()).set("stockflow_org",firstOrg.rows[0].id,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*8});}
  }
  const selectedOrganization=selectedOrganizationId?await run<{name:string}>("SELECT name FROM organizations WHERE id=$1",[selectedOrganizationId]):null;
  return NextResponse.json({user:{id:user.id,email:user.email,name:user.name,role:user.role.toLowerCase(),active:user.active,team:user.team,organizationId:selectedOrganizationId,organizationName:selectedOrganization?.rows[0]?.name??"إدارة المنصة",isSuperAdmin:user.is_super_admin}});
}
