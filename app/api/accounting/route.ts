import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/auth";

// Full financial snapshot for the workspace, optionally limited to a [from,to] date range.
export async function GET(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const params=new URL(request.url).searchParams; const from=params.get("from"); const to=params.get("to");
  const org=context.organizationId;

  // Build shared date filters. w.* for withdrawals, e.* handled separately for expenses.
  const wValues:unknown[]=[org]; const wFilters=["s.organization_id=$1","s.status<>'CANCELLED'"];
  if(from){wValues.push(from);wFilters.push(`s.sold_at>=$${wValues.length}::date`);}
  if(to){wValues.push(to);wFilters.push(`s.sold_at<=$${wValues.length}::date`);}
  const wWhere=wFilters.join(" AND ");

  const eValues:unknown[]=[org]; const eFilters=["organization_id=$1"];
  if(from){eValues.push(from);eFilters.push(`spent_at>=$${eValues.length}::date`);}
  if(to){eValues.push(to);eFilters.push(`spent_at<=$${eValues.length}::date`);}
  const eWhere=eFilters.join(" AND ");

  const [summary, expensesAgg, perService, perEmployee, debts, expensesByCategory] = await Promise.all([
    query(`SELECT
      COALESCE(SUM(s.total_amount),0)::int AS revenue,
      COALESCE(SUM(s.paid_amount),0)::int AS collected,
      COALESCE(SUM(s.cost_amount),0)::int AS cost,
      COALESCE(SUM(s.total_amount-s.paid_amount),0)::int AS outstanding,
      COUNT(*)::int AS sales
      FROM sales s WHERE ${wWhere}`, wValues),
    query(`SELECT COALESCE(SUM(amount),0)::int AS total FROM expenses WHERE ${eWhere}`, eValues),
    query(`SELECT COALESCE(NULLIF(s.service_name,''),s.item_description) AS name,
      COALESCE(SUM(s.total_amount),0)::int AS revenue,
      COALESCE(SUM(s.cost_amount),0)::int AS cost,
      COALESCE(SUM(s.total_amount-s.cost_amount),0)::int AS profit,
      COUNT(*)::int AS sales
      FROM sales s WHERE ${wWhere}
      GROUP BY COALESCE(NULLIF(s.service_name,''),s.item_description) ORDER BY profit DESC`, wValues),
    query(`SELECT u.name,
      COALESCE(SUM(s.total_amount),0)::int AS revenue,
      COALESCE(SUM(s.total_amount-s.cost_amount),0)::int AS profit,
      COUNT(*)::int AS sales
      FROM sales s JOIN users u ON u.id=s.created_by WHERE ${wWhere}
      GROUP BY u.name ORDER BY revenue DESC`, wValues),
    query(`SELECT
      COALESCE(NULLIF(s.customer_phone,''), s.customer_name) AS customer,
      MAX(s.customer_name) AS customer_name,
      COALESCE(SUM(s.total_amount),0)::int AS total,
      COALESCE(SUM(s.paid_amount),0)::int AS paid,
      COALESCE(SUM(s.total_amount-s.paid_amount),0)::int AS remaining,
      COUNT(*)::int AS sales
      FROM sales s WHERE ${wWhere}
      GROUP BY COALESCE(NULLIF(s.customer_phone,''), s.customer_name)
      HAVING COALESCE(SUM(s.total_amount-s.paid_amount),0) > 0
      ORDER BY remaining DESC LIMIT 200`, wValues),
    query(`SELECT category, COALESCE(SUM(amount),0)::int AS total FROM expenses WHERE ${eWhere}
      GROUP BY category ORDER BY total DESC`, eValues),
  ]);

  const s=summary.rows[0] as { revenue:number; collected:number; cost:number; outstanding:number; sales:number };
  const expenses=(expensesAgg.rows[0] as { total:number }).total;
  const grossProfit=s.revenue - s.cost;
  const netProfit=grossProfit - expenses;
  const treasury=s.collected - expenses; // cash actually collected minus what we spent

  return NextResponse.json({
    summary: {
      revenue: s.revenue, collected: s.collected, cost: s.cost, outstanding: s.outstanding,
      expenses, grossProfit, netProfit, treasury, sales: s.sales,
    },
    perService: perService.rows,
    perEmployee: perEmployee.rows,
    debts: debts.rows,
    expensesByCategory: expensesByCategory.rows,
  });
}
