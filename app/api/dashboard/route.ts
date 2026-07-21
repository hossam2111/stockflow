import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/auth";

export async function GET() {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const trendStart = new Date(startOfDay); trendStart.setDate(trendStart.getDate() - 6);
  const [inventory,withdrawals,employees,trendRows,lowStock,topEmployees,recentActivity] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='AVAILABLE' AND current_usage<max_usage)::int AS available,
      COUNT(*) FILTER (WHERE current_usage>0)::int AS used FROM inventory_items WHERE organization_id=$1`,[context.organizationId]),
    query("SELECT COUNT(*)::int AS today FROM withdrawals WHERE organization_id=$1 AND status='COMPLETED' AND created_at >= $2", [context.organizationId,startOfDay]),
    query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active=TRUE)::int AS active FROM users WHERE organization_id=$1 AND role='EMPLOYEE'",[context.organizationId]),
    query(`SELECT TO_CHAR(created_at AT TIME ZONE 'Africa/Cairo','YYYY-MM-DD') AS day,COUNT(*)::int AS count
      FROM withdrawals WHERE organization_id=$1 AND status='COMPLETED' AND created_at >= $2
      GROUP BY day ORDER BY day`,[context.organizationId,trendStart]),
    query(`SELECT s.id,s.name,COALESCE(SUM(CASE WHEN i.status='AVAILABLE' AND i.current_usage<i.max_usage
      THEN i.max_usage-i.current_usage ELSE 0 END),0)::int AS available_slots
      FROM services s LEFT JOIN inventory_items i ON i.service_id=s.id AND i.organization_id=$1
      WHERE s.organization_id=$1 AND s.active=TRUE GROUP BY s.id,s.name
      ORDER BY available_slots ASC,s.name ASC LIMIT 4`,[context.organizationId]),
    query(`SELECT u.id,u.name,COALESCE(u.team,'بدون فريق') AS team,COUNT(w.id)::int AS withdrawals
      FROM users u LEFT JOIN withdrawals w ON w.user_id=u.id AND w.organization_id=$1
        AND w.status='COMPLETED' AND w.created_at >= $2
      WHERE u.organization_id=$1 AND u.role='EMPLOYEE'
      GROUP BY u.id,u.name,u.team ORDER BY withdrawals DESC,u.name ASC LIMIT 3`,[context.organizationId,startOfMonth]),
    query(`SELECT w.id,u.name,s.name AS service,w.customer_name,w.created_at
      FROM withdrawals w JOIN users u ON u.id=w.user_id JOIN services s ON s.id=w.service_id
      WHERE w.organization_id=$1 AND w.status='COMPLETED'
      ORDER BY w.created_at DESC LIMIT 4`,[context.organizationId]),
  ]);
  const counts = new Map(trendRows.rows.map((row) => [String(row.day),Number(row.count)]));
  const withdrawalTrend = Array.from({length:7},(_,index) => {
    const date = new Date(trendStart); date.setDate(trendStart.getDate()+index);
    const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    return {day,count:counts.get(day) ?? 0};
  });
  return NextResponse.json({
    inventory:inventory.rows[0],withdrawalsToday:withdrawals.rows[0]?.today ?? 0,employees:employees.rows[0],
    withdrawalTrend,lowStock:lowStock.rows,topEmployees:topEmployees.rows,recentActivity:recentActivity.rows,
  });
}
