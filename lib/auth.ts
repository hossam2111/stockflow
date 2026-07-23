import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { PermissionKey } from "@/lib/access-control";

const secret=new TextEncoder().encode(process.env.AUTH_SECRET||"stockflow-development-secret-change-in-production");
export type SessionUser={id:string;email:string;name:string;role:"ADMIN"|"EMPLOYEE";organizationId:string|null;isSuperAdmin:boolean};
export async function createSession(user:SessionUser,timeoutMinutes=480){
  const minutes=Math.min(1440,Math.max(15,timeoutMinutes));
  const token=await new SignJWT(user).setProtectedHeader({alg:"HS256"}).setSubject(user.id).setIssuedAt().setExpirationTime(`${minutes}m`).sign(secret);
  (await cookies()).set("stockflow_session",token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*minutes});
}
export async function getSession():Promise<SessionUser|null>{
  const token=(await cookies()).get("stockflow_session")?.value;if(!token)return null;
  try{const {payload}=await jwtVerify(token,secret);return {id:String(payload.id||payload.sub),email:String(payload.email),name:String(payload.name),role:payload.role as SessionUser["role"],organizationId:payload.organizationId?String(payload.organizationId):null,isSuperAdmin:Boolean(payload.isSuperAdmin)};}catch{return null;}
}
export async function requireSession(role?:SessionUser["role"]){const user=await getSession();if(!user||role&&user.role!==role)return null;return user;}

export async function getWorkspaceContext(){
  const session=await getSession();
  if(!session)return null;
  const selected=session.isSuperAdmin?(await cookies()).get("stockflow_org")?.value:null;
  return {session,organizationId:selected||session.organizationId};
}

export async function requireWorkspaceAdmin(){
  const context=await getWorkspaceContext();
  if(!context||context.session.role!=="ADMIN"||!context.organizationId)return null;
  const {query}=await import("@/lib/db");
  const active=await query<{user_active:boolean;organization_active:boolean}>("SELECT u.active AS user_active,o.active AS organization_active FROM users u JOIN organizations o ON o.id=$2 WHERE u.id=$1",[context.session.id,context.organizationId]);
  if(!active.rows[0]?.user_active||!active.rows[0]?.organization_active)return null;
  return context;
}

export async function requireWorkspaceAccounting(){
  const context=await getWorkspaceContext();
  if(!context?.organizationId)return null;
  if(context.session.role==="ADMIN")return context;
  const {query}=await import("@/lib/db");
  const permission=await query<{can_manage_accounting:boolean;active:boolean}>("SELECT can_manage_accounting,active FROM users WHERE id=$1 AND organization_id=$2 AND role='EMPLOYEE'",[context.session.id,context.organizationId]);
  return permission.rows[0]?.active&&permission.rows[0]?.can_manage_accounting?context:null;
}

export async function requireWorkspacePermission(permission:PermissionKey){
  const context=await getWorkspaceContext();
  if(!context?.organizationId)return null;
  const {query}=await import("@/lib/db");
  const active=await query<{user_active:boolean;organization_active:boolean}>("SELECT u.active AS user_active,o.active AS organization_active FROM users u JOIN organizations o ON o.id=$2 WHERE u.id=$1",[context.session.id,context.organizationId]);
  if(!active.rows[0]?.user_active||!active.rows[0]?.organization_active)return null;
  const {getUserAccess}=await import("@/lib/access-control");
  const access=await getUserAccess(context.session.id,context.organizationId,context.session.role);
  return access.permissions.includes(permission)?{...context,access}:null;
}
