import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDb, query } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/auth";

const saleSchema=z.object({
  customerName:z.string().trim().min(2).max(120), customerPhone:z.string().trim().max(40).optional().default(""),
  serviceName:z.string().trim().min(2).max(120),
  quantity:z.number().int().min(1).max(10000).default(1), totalAmount:z.number().int().min(0).max(100000000),
  costAmount:z.number().int().min(0).max(100000000).default(0), paidAmount:z.number().int().min(0).max(100000000).default(0),
  status:z.enum(["COMPLETED","PENDING","CANCELLED"]).default("COMPLETED"), notes:z.string().trim().max(1000).optional().default(""),
  soldAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((value)=>value.paidAmount<=value.totalAmount,{message:"PAID_EXCEEDS_TOTAL"});

export async function GET(request:Request){
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});await ensureDb();
  const p=new URL(request.url).searchParams;const values:unknown[]=[context.organizationId];const filters=["s.organization_id=$1"];
  if(p.get("from")){values.push(p.get("from"));filters.push(`s.sold_at>=$${values.length}::date`);}if(p.get("to")){values.push(p.get("to"));filters.push(`s.sold_at<=$${values.length}::date`);}
  const result=await query(`SELECT s.*,u.name AS created_by_name FROM sales s LEFT JOIN users u ON u.id=s.created_by WHERE ${filters.join(" AND ")} ORDER BY s.sold_at DESC,s.created_at DESC LIMIT 3000`,values);
  return NextResponse.json({sales:result.rows});
}
export async function POST(request:Request){
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});const parsed=saleSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT"},{status:400});await ensureDb();const v=parsed.data;const id=`SALE-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  await query(`INSERT INTO sales(id,organization_id,created_by,source,service_name,item_description,customer_name,customer_phone,quantity,total_amount,cost_amount,paid_amount,status,notes,sold_at) VALUES($1,$2,$3,'MANUAL',$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[id,context.organizationId,context.session.id,v.serviceName,v.customerName,v.customerPhone||null,v.quantity,v.totalAmount,v.costAmount,v.paidAmount,v.status,v.notes||null,v.soldAt]);return NextResponse.json({id},{status:201});
}
export async function PATCH(request:Request){
  const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});const id=new URL(request.url).searchParams.get("id");const parsed=saleSchema.safeParse(await request.json());if(!id||!parsed.success)return NextResponse.json({error:"INVALID_INPUT"},{status:400});const v=parsed.data;
  const result=await query(`UPDATE sales SET service_name=$1,item_description=$1,customer_name=$2,customer_phone=$3,quantity=$4,total_amount=$5,cost_amount=$6,paid_amount=$7,status=$8,notes=$9,sold_at=$10,updated_at=NOW() WHERE id=$11 AND organization_id=$12 RETURNING id`,[v.serviceName,v.customerName,v.customerPhone||null,v.quantity,v.totalAmount,v.costAmount,v.paidAmount,v.status,v.notes||null,v.soldAt,id,context.organizationId]);if(!result.rows[0])return NextResponse.json({error:"NOT_FOUND"},{status:404});return NextResponse.json({id});
}
export async function DELETE(request:Request){const context=await requireWorkspaceAdmin();if(!context)return NextResponse.json({error:"FORBIDDEN"},{status:403});const id=new URL(request.url).searchParams.get("id");if(!id)return NextResponse.json({error:"INVALID_INPUT"},{status:400});const result=await query("DELETE FROM sales WHERE id=$1 AND organization_id=$2 RETURNING id",[id,context.organizationId]);if(!result.rows[0])return NextResponse.json({error:"NOT_FOUND"},{status:404});return NextResponse.json({deleted:id});}
