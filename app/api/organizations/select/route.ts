import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

export async function POST(request:Request){
  const session=await requireSession("ADMIN");if(!session?.isSuperAdmin)return NextResponse.json({error:"FORBIDDEN"},{status:403});
  const parsed=z.object({organizationId:z.string()}).safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT"},{status:400});
  const org=await query<{id:string;name:string;active:boolean}>("SELECT id,name,active FROM organizations WHERE id=$1",[parsed.data.organizationId]);
  if(!org.rows[0])return NextResponse.json({error:"NOT_FOUND"},{status:404});
  (await cookies()).set("stockflow_org",org.rows[0].id,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*8});
  return NextResponse.json({organization:org.rows[0]});
}
