import { query } from "@/lib/db";

export const permissionKeys = [
  "dashboard.view","withdrawals.create","withdrawals.view_own","inventory.view","inventory.manage",
  "services.manage","employees.manage","reports.view","sales.view_all","sales.manage",
  "accounting.view","accounting.manage","suppliers.manage","activity.view","settings.manage","exports.use",
] as const;
export type PermissionKey = typeof permissionKeys[number];
export type AccessRole = "OWNER"|"ADMIN"|"ACCOUNTANT"|"SALES"|"EMPLOYEE"|"AUDITOR";

export const rolePermissions:Record<AccessRole,readonly PermissionKey[]>={
  OWNER:permissionKeys,
  ADMIN:permissionKeys.filter(key=>key!=="settings.manage"),
  ACCOUNTANT:["dashboard.view","reports.view","sales.view_all","accounting.view","accounting.manage","suppliers.manage","exports.use"],
  SALES:["dashboard.view","withdrawals.create","withdrawals.view_own","sales.view_all","sales.manage","reports.view","exports.use"],
  EMPLOYEE:["withdrawals.create","withdrawals.view_own"],
  AUDITOR:["dashboard.view","inventory.view","reports.view","sales.view_all","accounting.view","activity.view","exports.use"],
};

export async function getUserAccess(userId:string,organizationId:string,systemRole:"ADMIN"|"EMPLOYEE"){
  if(systemRole==="ADMIN")return {accessRole:"OWNER" as AccessRole,permissions:[...permissionKeys]};
  const user=await query<{access_role:AccessRole;can_manage_accounting:boolean}>("SELECT access_role,can_manage_accounting FROM users WHERE id=$1 AND organization_id=$2 AND active=TRUE",[userId,organizationId]);
  if(!user.rows[0])return {accessRole:"EMPLOYEE" as AccessRole,permissions:[] as PermissionKey[]};
  const accessRole=user.rows[0].access_role|| (user.rows[0].can_manage_accounting?"ACCOUNTANT":"EMPLOYEE");
  const overrides=await query<{permission_key:PermissionKey;enabled:boolean}>("SELECT permission_key,enabled FROM user_permissions WHERE user_id=$1 AND organization_id=$2",[userId,organizationId]);
  const permissions=new Set<PermissionKey>(rolePermissions[accessRole]??rolePermissions.EMPLOYEE);
  for(const override of overrides.rows){if(override.enabled)permissions.add(override.permission_key);else permissions.delete(override.permission_key);}
  return {accessRole,permissions:[...permissions]};
}
