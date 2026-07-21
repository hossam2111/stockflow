import { NextResponse } from "next/server";
import { cookies } from "next/headers";
export async function POST(){const jar=await cookies();jar.delete("stockflow_session");jar.delete("stockflow_org");return NextResponse.json({ok:true});}
