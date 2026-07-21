import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/auth";

export async function GET() {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const result = await query(`SELECT l.id,l.action,l.entity_type,l.entity_id,l.metadata,l.created_at,
    COALESCE(u.name,'النظام') AS actor FROM activity_logs l LEFT JOIN users u ON u.id=l.actor_id
    WHERE l.organization_id=$1 ORDER BY l.created_at DESC LIMIT 200`,[context.organizationId]);
  return NextResponse.json({ activity: result.rows });
}
