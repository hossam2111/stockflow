import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptApiKey, validateOpenAiKey } from "@/lib/ai-credentials";
import { ensureDb, query } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/auth";

const allowedModels = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] as const;
const inputSchema = z.object({
  apiKey: z.string().trim().min(20).max(512).refine((value) => value.startsWith("sk-"), "INVALID_KEY_FORMAT"),
  model: z.enum(allowedModels).default("gpt-5.6-terra"),
});

export async function GET() {
  const context = await requireWorkspaceAdmin();
  if (!context) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  await ensureDb();
  const result = await query<{key_hint:string;model:string;enabled:boolean;updated_at:string}>(
    `SELECT key_hint,model,enabled,updated_at FROM ai_connections
     WHERE user_id=$1 AND organization_id=$2 LIMIT 1`,
    [context.session.id, context.organizationId],
  );
  const connection = result.rows[0];
  return NextResponse.json({ connected: Boolean(connection), connection: connection ? {
    provider: "OpenAI", keyHint: connection.key_hint, model: connection.model,
    enabled: connection.enabled, updatedAt: connection.updated_at,
  } : null });
}

export async function POST(request: Request) {
  const context = await requireWorkspaceAdmin();
  if (!context) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const validation = await validateOpenAiKey(parsed.data.apiKey).catch(() => ({ valid: false as const, reason: "OPENAI_UNAVAILABLE" }));
  if (!validation.valid) return NextResponse.json({ error: validation.reason }, { status: validation.reason === "INVALID_KEY" ? 401 : 502 });

  await ensureDb();
  const encrypted = encryptApiKey(parsed.data.apiKey);
  await query(
    `INSERT INTO ai_connections(user_id,organization_id,encrypted_api_key,key_iv,key_tag,key_hint,model,enabled)
     VALUES($1,$2,$3,$4,$5,$6,$7,TRUE)
     ON CONFLICT(user_id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
       encrypted_api_key=EXCLUDED.encrypted_api_key,key_iv=EXCLUDED.key_iv,key_tag=EXCLUDED.key_tag,
       key_hint=EXCLUDED.key_hint,model=EXCLUDED.model,enabled=TRUE,updated_at=NOW()`,
    [context.session.id, context.organizationId, encrypted.encryptedApiKey, encrypted.iv, encrypted.tag, encrypted.hint, parsed.data.model],
  );
  await query(
    `INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata)
     VALUES($1,$2,$3,'AI_CONNECTION_UPDATED','AI_CONNECTION',$3,$4)`,
    [`ACT-${crypto.randomUUID()}`, context.organizationId, context.session.id, JSON.stringify({ provider: "OPENAI", model: parsed.data.model })],
  );
  return NextResponse.json({ connected: true, keyHint: encrypted.hint, model: parsed.data.model });
}

export async function DELETE() {
  const context = await requireWorkspaceAdmin();
  if (!context) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  await ensureDb();
  await query("DELETE FROM ai_connections WHERE user_id=$1 AND organization_id=$2", [context.session.id, context.organizationId]);
  await query(
    `INSERT INTO activity_logs(id,organization_id,actor_id,action,entity_type,entity_id,metadata)
     VALUES($1,$2,$3,'AI_CONNECTION_REMOVED','AI_CONNECTION',$3,'{}')`,
    [`ACT-${crypto.randomUUID()}`, context.organizationId, context.session.id],
  );
  return NextResponse.json({ connected: false });
}
