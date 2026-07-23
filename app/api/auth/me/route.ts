import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const {session,organizationId}=context;
  const result = await query<{ active: boolean; team: string; can_manage_accounting:boolean }>("SELECT active,team,can_manage_accounting FROM users WHERE id=$1", [session.id]);
  const organization=organizationId?await query<{id:string;name:string}>("SELECT id,name FROM organizations WHERE id=$1",[organizationId]):null;
  return NextResponse.json({
    user: {
      id: session.id,
      email: session.email,
      name: session.name,
      role: session.role.toLowerCase(),
      active: result.rows[0]?.active ?? false,
      team: result.rows[0]?.team ?? "",
      organizationId,
      organizationName: organization?.rows[0]?.name ?? "إدارة المنصة",
      isSuperAdmin: session.isSuperAdmin,
      canManageAccounting: result.rows[0]?.can_manage_accounting ?? false,
    },
  });
}
