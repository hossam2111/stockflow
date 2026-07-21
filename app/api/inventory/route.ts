import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { requireWorkspaceAdmin } from "@/lib/auth";

const itemSchema = z.object({
  serviceId: z.string().min(1), email: z.string().email(), password: z.string().min(1),
  otpSecret: z.string().optional().nullable(), otpUrl: z.string().url().optional().nullable(),
  accountType: z.enum(["INDIVIDUAL","SHARED"]), maxUsage: z.number().int().min(1).max(100).default(1),
});

export async function GET(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const url = new URL(request.url); const serviceId = url.searchParams.get("serviceId"); const search = url.searchParams.get("search") || "";
  const values: unknown[] = [context.organizationId];
  const filters = ["i.organization_id=$1"];
  if (serviceId) {
    values.push(serviceId);
    filters.push(`i.service_id=$${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(LOWER(i.email) LIKE LOWER($${values.length}) OR LOWER(i.id) LIKE LOWER($${values.length}))`);
  }
  const result = await query(`SELECT i.id,i.service_id,s.name AS service,i.email,i.password,i.otp_secret,i.otp_url,
    i.account_type,i.max_usage,i.current_usage,i.status,i.created_at,
    (i.otp_secret IS NOT NULL) AS otp_ready FROM inventory_items i JOIN services s ON s.id=i.service_id
    WHERE ${filters.join(" AND ")}
    ORDER BY i.created_at DESC LIMIT 200`, values);
  return NextResponse.json({ items: result.rows });
}

export async function POST(request: Request) {
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const body = await request.json(); const rows = z.array(itemSchema).min(1).max(10000).safeParse(body.items);
  if (!rows.success) return NextResponse.json({ error:"INVALID_ITEMS", details:rows.error.flatten() }, { status:400 });
  const organization=await query<{inventory_limit:number}>("SELECT inventory_limit FROM organizations WHERE id=$1",[context.organizationId]);
  const inventoryCount=await query<{total:number}>("SELECT COUNT(*)::int AS total FROM inventory_items WHERE organization_id=$1",[context.organizationId]);
  const remaining=Math.max(0,(organization.rows[0]?.inventory_limit??0)-(inventoryCount.rows[0]?.total??0));
  if(remaining<=0)return NextResponse.json({error:"INVENTORY_LIMIT_REACHED"},{status:403});
  const acceptedRows=rows.data.slice(0,remaining);
  let inserted=0, duplicates=0;
  for (const item of acceptedRows) {
    const service=await query("SELECT id FROM services WHERE id=$1 AND organization_id=$2",[item.serviceId,context.organizationId]);
    if(!service.rows[0])continue;
    const existing=await query("SELECT id FROM inventory_items WHERE organization_id=$1 AND service_id=$2 AND LOWER(email)=LOWER($3) LIMIT 1",[context.organizationId,item.serviceId,item.email]);
    if(existing.rows[0]){duplicates++;continue;}
    const result = await query(`INSERT INTO inventory_items(id,organization_id,service_id,email,password,otp_secret,otp_url,account_type,max_usage)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (service_id,email) DO NOTHING RETURNING id`,
      [`STK-${crypto.randomUUID().slice(0,8).toUpperCase()}`,context.organizationId,item.serviceId,item.email,item.password,item.otpSecret,item.otpUrl,item.accountType,item.accountType==="INDIVIDUAL"?1:item.maxUsage]);
    if (result.rowCount) inserted++;
    else duplicates++;
  }
  await query(`INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata)
    VALUES ($1,$2,$3,'INVENTORY_IMPORT','INVENTORY',$4,$5)`, [
    crypto.randomUUID(),context.organizationId,context.session.id,rows.data[0].serviceId,
    JSON.stringify({ requested: rows.data.length,accepted:acceptedRows.length,inserted,duplicates }),
  ]);
  return NextResponse.json({ inserted, duplicates }, { status:201 });
}
