import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { newDb } from "pg-mem";
import bcrypt from "bcryptjs";

declare global {
  var stockflowPool: Pool | undefined;
  var stockflowReady: Promise<void> | undefined;
  var stockflowMigrationReady: Promise<void> | undefined;
  var stockflowMemory: boolean | undefined;
}

const schema = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE, employee_limit INTEGER NOT NULL DEFAULT 25,
    inventory_limit INTEGER NOT NULL DEFAULT 10000, plan TEXT NOT NULL DEFAULT 'PRO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('ADMIN','EMPLOYEE')),
    organization_id TEXT REFERENCES organizations(id), is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    team TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, daily_limit INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE, default_daily_limit INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id,name)
  )`,
  `CREATE TABLE IF NOT EXISTS employee_service_permissions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE, daily_limit INTEGER NOT NULL DEFAULT 5,
    PRIMARY KEY (user_id, service_id)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), service_id TEXT NOT NULL REFERENCES services(id),
    email TEXT NOT NULL, password TEXT NOT NULL, otp_secret TEXT, otp_url TEXT,
    account_type TEXT NOT NULL CHECK (account_type IN ('INDIVIDUAL','SHARED')),
    max_usage INTEGER NOT NULL DEFAULT 1, current_usage INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id, email)
  )`,
  `CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id), service_id TEXT NOT NULL REFERENCES services(id),
    inventory_item_id TEXT REFERENCES inventory_items(id), status TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL, previous_usage INTEGER, new_usage INTEGER,
    batch_id TEXT, batch_quantity INTEGER NOT NULL DEFAULT 1,
    customer_name TEXT, customer_phone TEXT, customer_contact TEXT, customer_reference TEXT, customer_notes TEXT,
    subscription_start_date DATE, subscription_months INTEGER, subscription_end_date DATE,
    warranty_days INTEGER NOT NULL DEFAULT 0, warranty_end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id), actor_id TEXT, action TEXT NOT NULL, entity_type TEXT,
    entity_id TEXT, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS withdrawals_user_created_idx ON withdrawals(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS inventory_available_idx ON inventory_items(service_id, status, created_at)`,
];

const withdrawalColumns = [
  "organization_id TEXT REFERENCES organizations(id)",
  "batch_id TEXT",
  "batch_quantity INTEGER NOT NULL DEFAULT 1",
  "customer_name TEXT",
  "customer_phone TEXT",
  "customer_contact TEXT",
  "customer_reference TEXT",
  "customer_notes TEXT",
  "subscription_start_date DATE",
  "subscription_months INTEGER",
  "subscription_end_date DATE",
  "warranty_days INTEGER NOT NULL DEFAULT 0",
  "warranty_end_date DATE",
];

const tenantColumns: Record<string, string[]> = {
  users: ["organization_id TEXT REFERENCES organizations(id)", "is_super_admin BOOLEAN NOT NULL DEFAULT FALSE"],
  services: ["organization_id TEXT REFERENCES organizations(id)"],
  inventory_items: ["organization_id TEXT REFERENCES organizations(id)"],
  activity_logs: ["organization_id TEXT REFERENCES organizations(id)"],
};

function createPool() {
  const url = process.env.DATABASE_URL;
  if (url && !url.includes("change_me")) {
    globalThis.stockflowMemory = false;
    return new Pool({ connectionString: url, max: 15 });
  }
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  memory.public.registerFunction({ name: "current_database", implementation: () => "stockflow" });
  const adapter = memory.adapters.createPg();
  globalThis.stockflowMemory = true;
  return new adapter.Pool() as unknown as Pool;
}

export function getPool() {
  if (!globalThis.stockflowPool) globalThis.stockflowPool = createPool();
  return globalThis.stockflowPool;
}

export async function ensureDb() {
  if (!globalThis.stockflowReady) {
    globalThis.stockflowReady = (async () => {
      const pool = getPool();
      for (const statement of schema) await pool.query(statement);
      const adminHash = await bcrypt.hash("admin123", 10);
      const companyAdminHash = await bcrypt.hash("Company@123", 10);
      const omarHash = await bcrypt.hash("Omar@123", 10);
      await pool.query(`INSERT INTO organizations(id,name,slug,plan,employee_limit,inventory_limit)
        VALUES ('org-demo','شركة StockFlow التجريبية','stockflow-demo','PRO',50,50000) ON CONFLICT (id) DO NOTHING`);
      await pool.query(`INSERT INTO users(id,email,password_hash,name,role,organization_id,is_super_admin,team,active,daily_limit)
        VALUES ('admin','admin@stockflow.io',$1,'حسام محمد','ADMIN',NULL,TRUE,'إدارة المنصة',TRUE,999),
               ('company-admin','company@stockflow.io',$2,'أدمن الشركة','ADMIN','org-demo',FALSE,'الإدارة',TRUE,999),
               ('omar','omar@stockflow.io',$3,'عمر خالد','EMPLOYEE','org-demo',FALSE,'صفحة القاهرة',TRUE,20)
        ON CONFLICT (id) DO NOTHING`, [adminHash, companyAdminHash, omarHash]);
      const serviceRows = [
        ["chatgpt", "ChatGPT Plus", 10], ["adobe", "Adobe CC", 5], ["canva", "Canva Pro", 4],
        ["claude", "Claude Pro", 4], ["perplexity", "Perplexity", 4], ["midjourney", "Midjourney", 3],
      ];
      for (const row of serviceRows) {
        await pool.query(`INSERT INTO services(id,organization_id,name,default_daily_limit) VALUES ($1,'org-demo',$2,$3) ON CONFLICT (id) DO NOTHING`, row);
        await pool.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
          VALUES ('omar',$1,$2,$3) ON CONFLICT (user_id,service_id) DO NOTHING`, [row[0], !["perplexity","midjourney"].includes(String(row[0])), row[2]]);
      }
      const inventory = [
        ["STK-2048","chatgpt","client28@vault.io","V@ult#9281","JBSWY3DPEHPK3PXP","https://2fa.live","SHARED",5,3],
        ["STK-2047","adobe","design91@vault.io","Adobe#441","KRSXG5DSNFXGC4TF","https://2fa.live","INDIVIDUAL",1,0],
        ["STK-2046","canva","canva17@vault.io","Canva!778","MZXW6YTBOI======","https://totp.danhersam.com","SHARED",5,4],
        ["STK-2044","perplexity","pro08@vault.io","Perp!2026","ONSWG4TFORUGS4ZA","https://totp.danhersam.com","SHARED",5,2],
      ];
      for (const item of inventory) await pool.query(`INSERT INTO inventory_items
        (id,organization_id,service_id,email,password,otp_secret,otp_url,account_type,max_usage,current_usage)
        VALUES ($1,'org-demo',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`, item);
    })();
  }
  await globalThis.stockflowReady;
  if (!globalThis.stockflowMigrationReady) {
    globalThis.stockflowMigrationReady = (async () => {
      const pool = getPool();
      for (const [table, definitions] of Object.entries({ ...tenantColumns, withdrawals: withdrawalColumns })) {
        const existing = await pool.query<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_name=$1", [table],
        );
        const names = new Set(existing.rows.map((row) => row.column_name));
        for (const definition of definitions) {
          const name = definition.split(" ")[0];
          if (!names.has(name)) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
        }
      }
    })();
  }
  await globalThis.stockflowMigrationReady;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  await ensureDb();
  return getPool().query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  await ensureDb();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const isMemoryDatabase = () => globalThis.stockflowMemory === true;
