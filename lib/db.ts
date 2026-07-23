import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { newDb } from "pg-mem";

declare global {
  var stockflowPool: Pool | undefined;
  var stockflowReady: Promise<void> | undefined;
  var stockflowMigrationReady: Promise<void> | undefined;
  var stockflowCatalogueReady: Promise<void> | undefined;
  var stockflowMemory: boolean | undefined;
}
globalThis.stockflowPool = undefined;
globalThis.stockflowReady = undefined;

// Single source of truth for the platform-wide service catalogue, in display order. Adding a service
// here (and bumping CATALOGUE_MARKER) makes it apply to EVERY organization on the next startup.
export const serviceCatalogue: [string, number][] = [
  ["Google Gemini", 5], ["ChatGPT Plus", 10], ["CapCut Pro", 5], ["Grok", 4],
  ["Pro Apps", 5], ["Canva Pro", 4], ["Claude Pro", 4], ["Perplexity", 4], ["Midjourney", 3],
  ["Adobe CC", 5], ["Spotify Premium", 10], ["Netflix Premium", 8], ["YouTube Premium", 8],
  ["Disney+", 6], ["Shahid VIP", 6], ["Duolingo Super", 5], ["GitHub Copilot", 12], ["Microsoft 365", 6],
];
const CATALOGUE_MARKER = "services-catalogue-v2";
const PRO_APPS_SEED_MARKER = "pro-apps-dummy-stock-v1";
const PRO_APPS_SEED_MARKER_V2 = "pro-apps-demo-stock-v2";

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
    can_manage_accounting BOOLEAN NOT NULL DEFAULT FALSE,
    access_role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE, default_daily_limit INTEGER NOT NULL DEFAULT 10,
    default_cost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id,name)
  )`,
  `CREATE TABLE IF NOT EXISTS employee_service_permissions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE, daily_limit INTEGER NOT NULL DEFAULT 5,
    PRIMARY KEY (user_id, service_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_permissions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY(user_id,permission_key)
  )`,
  `CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    system_name TEXT NOT NULL DEFAULT 'StockFlow', timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
    currency TEXT NOT NULL DEFAULT 'EGP', language TEXT NOT NULL DEFAULT 'ar',
    allocation_strategy TEXT NOT NULL DEFAULT 'FIFO', low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 480, allow_shared_accounts BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), service_id TEXT NOT NULL REFERENCES services(id),
    email TEXT NOT NULL, password TEXT NOT NULL, otp_secret TEXT, otp_url TEXT,
    account_type TEXT NOT NULL CHECK (account_type IN ('INDIVIDUAL','SHARED')),
    max_usage INTEGER NOT NULL DEFAULT 1, current_usage INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date DATE,
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
    selling_price INTEGER DEFAULT 0, cost INTEGER DEFAULT 0, paid_amount INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id), actor_id TEXT, action TEXT NOT NULL, entity_type TEXT,
    entity_id TEXT, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT,
    description TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'GENERAL', amount INTEGER NOT NULL DEFAULT 0,
    spent_at DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL, phone TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    item TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit_cost INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0,
    purchased_at DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS wages (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL, role TEXT, amount INTEGER NOT NULL DEFAULT 0,
    paid_at DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS ai_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'OPENAI', encrypted_api_key TEXT NOT NULL,
    key_iv TEXT NOT NULL, key_tag TEXT NOT NULL, key_hint TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gpt-5.6-terra', enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    withdrawal_id TEXT UNIQUE REFERENCES withdrawals(id) ON DELETE SET NULL,
    created_by TEXT REFERENCES users(id), source TEXT NOT NULL DEFAULT 'MANUAL',
    service_name TEXT, item_description TEXT NOT NULL, customer_name TEXT NOT NULL,
    customer_phone TEXT, quantity INTEGER NOT NULL DEFAULT 1,
    total_amount INTEGER NOT NULL DEFAULT 0, cost_amount INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'COMPLETED',
    notes TEXT, sold_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS sales_org_sold_idx ON sales(organization_id,sold_at DESC)`,
  `CREATE INDEX IF NOT EXISTS ai_connections_org_idx ON ai_connections(organization_id)`,
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
  "selling_price INTEGER DEFAULT 0",
  "cost INTEGER DEFAULT 0",
  "paid_amount INTEGER DEFAULT 0",
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
  memory.public.registerFunction({ name: "nullif", implementation: (a: string | null, b: string | null) => (a === b ? null : a) });
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

      // Always ensure the schema exists. These are idempotent CREATE ... IF NOT EXISTS statements, so
      // running them on every cold start is cheap AND it means brand-new tables (added later, like
      // `expenses`) appear on already-seeded databases too — the column migration below can't create
      // whole tables. Only the expensive ~85-query DATA seed is gated by the completion marker.
      for (const statement of schema) await pool.query(statement);
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_accounting BOOLEAN NOT NULL DEFAULT FALSE");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS access_role TEXT NOT NULL DEFAULT 'EMPLOYEE'");
      await pool.query("UPDATE users SET access_role=CASE WHEN role='ADMIN' THEN 'OWNER' WHEN can_manage_accounting THEN 'ACCOUNTANT' ELSE COALESCE(NULLIF(access_role,''),'EMPLOYEE') END");
      await pool.query("INSERT INTO organization_settings(organization_id) SELECT id FROM organizations ON CONFLICT(organization_id) DO NOTHING");
      await pool.query(`INSERT INTO sales(id,organization_id,withdrawal_id,created_by,source,service_name,item_description,
        customer_name,customer_phone,quantity,total_amount,cost_amount,paid_amount,status,notes,sold_at,created_at)
        SELECT 'SALE-'||w.id,w.organization_id,w.id,w.user_id,'WITHDRAWAL',s.name,s.name,
          COALESCE(NULLIF(w.customer_name,''),'عميل'),w.customer_phone,1,COALESCE(w.selling_price,0),
          COALESCE(w.cost,0),COALESCE(w.paid_amount,0),CASE WHEN w.status='RETURNED' THEN 'CANCELLED' ELSE 'COMPLETED' END,
          w.customer_notes,w.created_at::date,w.created_at
        FROM withdrawals w JOIN services s ON s.id=w.service_id
        ON CONFLICT(withdrawal_id) DO NOTHING`);
      const seeded = await pool.query("SELECT 1 FROM activity_logs WHERE id='seed-complete-v1' LIMIT 1");
      if (seeded.rows.length > 0) return;

      const adminHash = "$2b$10$Iok1m2/UFhOaM0.2NLatHOvmC5B9MC8vYDH26VehJvyJTKBWNHOYS";
      const companyAdminHash = "$2b$10$MopCftE/MgmAy1sjFSgVCOxdg6lnCNH2DR0kNZcn11pH9kdKF6H6i";
      const omarHash = "$2b$10$Lgg6TULfK1glxZNBcuN6lumC0nzYC2v1zrlACz1T5efjnifN0nKHG";
      const youssefHash = "$2b$10$GEh3cNecGpEdaHtHNqmnOeZpuDNBJNuD34UJUgtiMFxdDjn0P.CBy";
      const fatimaHash = "$2b$10$dHIAinO80QBwV7VGRiZ.1ebJ1mjcFM15ipQYXTnnMrWOnnpFeRA5y";
      const innovateAdminHash = "$2b$10$xHyJnAA1hCPF25KBIZQmb.DywmU3DMKBY/SjvwOAHNzQeLLWouFem";
      const khaledHash = "$2b$10$YG4VOyrHoaNqIBEo8zA02.QeE0BP4Thzt9p3buLWLPi7FR/3hY7y2";

      // Organizations
      await pool.query(`INSERT INTO organizations(id,name,slug,plan,employee_limit,inventory_limit)
        VALUES ('org-demo','شركة StockFlow التجريبية','stockflow-demo','PRO',50,50000) ON CONFLICT DO NOTHING`);
      await pool.query(`INSERT INTO organizations(id,name,slug,plan,employee_limit,inventory_limit)
        VALUES ('org-innovate','مؤسسة الابتكار الرقمي','digital-innovations','BUSINESS',100,100000) ON CONFLICT DO NOTHING`);

      // Users
      await pool.query(`INSERT INTO users(id,email,password_hash,name,role,organization_id,is_super_admin,team,active,daily_limit)
        VALUES ('admin','admin@stockflow.io',$1,'حسام محمد','ADMIN',NULL,TRUE,'إدارة المنصة',TRUE,999),
               ('company-admin','company@stockflow.io',$2,'أدمن الشركة','ADMIN','org-demo',FALSE,'الإدارة',TRUE,999),
               ('omar','omar@stockflow.io',$3,'عمر خالد','EMPLOYEE','org-demo',FALSE,'صفحة القاهرة',TRUE,20),
               ('youssef','youssef@stockflow.io',$4,'يوسف أحمد','EMPLOYEE','org-demo',FALSE,'فريق المبيعات',TRUE,15),
               ('fatima','fatima@stockflow.io',$5,'فاطمة عمر','EMPLOYEE','org-demo',FALSE,'فريق التصميم',TRUE,25),
               ('innovate-admin','innovate@stockflow.io',$6,'أدمن الابتكار','ADMIN','org-innovate',FALSE,'الإدارة',TRUE,999),
               ('khaled','khaled@stockflow.io',$7,'خالد حسن','EMPLOYEE','org-innovate',FALSE,'فريق المطورين',TRUE,30)
        ON CONFLICT DO NOTHING`, [adminHash, companyAdminHash, omarHash, youssefHash, fatimaHash, innovateAdminHash, khaledHash]);

      // Services
      const serviceRows = [
        ["chatgpt", "ChatGPT Plus", 10], ["adobe", "Adobe CC", 5], ["canva", "Canva Pro", 4],
        ["claude", "Claude Pro", 4], ["perplexity", "Perplexity", 4], ["midjourney", "Midjourney", 3],
        ["spotify", "Spotify Premium", 10], ["netflix", "Netflix Premium", 8], ["github", "GitHub Copilot", 12]
      ];
      
      // Seed Services for org-demo and permissions
      for (const row of serviceRows) {
        await pool.query(`INSERT INTO services(id,organization_id,name,default_daily_limit) VALUES ($1,'org-demo',$2,$3) ON CONFLICT DO NOTHING`, row);
        
        await pool.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
          VALUES ('omar',$1,$2,$3) ON CONFLICT DO NOTHING`, [row[0], !["perplexity","midjourney","spotify","netflix","github"].includes(String(row[0])), row[2]]);
          
        await pool.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
          VALUES ('youssef',$1,$2,$3) ON CONFLICT DO NOTHING`, [row[0], !["adobe","midjourney","github"].includes(String(row[0])), row[2]]);
          
        await pool.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
          VALUES ('fatima',$1,true,$2) ON CONFLICT DO NOTHING`, [row[0], row[2]]);
      }

      // Seed Services for org-innovate and permissions
      for (const row of serviceRows) {
        const svcId = `svc-in-${row[0]}`;
        await pool.query(`INSERT INTO services(id,organization_id,name,default_daily_limit) VALUES ($1,'org-innovate',$2,$3) ON CONFLICT DO NOTHING`, [svcId, row[1], row[2]]);
        await pool.query(`INSERT INTO employee_service_permissions(user_id,service_id,enabled,daily_limit)
          VALUES ('khaled',$1,TRUE,$2) ON CONFLICT DO NOTHING`, [svcId, row[2]]);
      }

      // Mark the seed as complete so subsequent cold starts short-circuit the block above.
      await pool.query(`INSERT INTO activity_logs(id,action,metadata) VALUES ('seed-complete-v1','SEED_COMPLETE','{}') ON CONFLICT DO NOTHING`);
    })();
  }
  // A cached promise that has already rejected stays rejected forever, so a single failed seed would
  // poison every later request until the process restarts. Clear the guard on failure so the next
  // request retries instead.
  try {
    await globalThis.stockflowReady;
  } catch (error) {
    globalThis.stockflowReady = undefined;
    throw error;
  }
  if (!globalThis.stockflowMigrationReady) {
    globalThis.stockflowMigrationReady = (async () => {
      const pool = getPool();
      for (const [table, definitions] of Object.entries({ ...tenantColumns, services: [...tenantColumns.services, "default_cost INTEGER NOT NULL DEFAULT 0"], inventory_items: [...tenantColumns.inventory_items, "expiry_date DATE"], withdrawals: withdrawalColumns })) {
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
  try {
    await globalThis.stockflowMigrationReady;
  } catch (error) {
    globalThis.stockflowMigrationReady = undefined;
    throw error;
  }
  // Keep the service catalogue in sync across ALL organizations. Gated by a version marker so it runs
  // once per catalogue version (bump CATALOGUE_MARKER when serviceCatalogue changes to re-sync).
  if (!globalThis.stockflowCatalogueReady) {
    globalThis.stockflowCatalogueReady = (async () => {
      const pool = getPool();
      const marker = await pool.query("SELECT 1 FROM activity_logs WHERE id=$1 LIMIT 1", [CATALOGUE_MARKER]);
      if (marker.rows.length > 0) return;
      const orgs = await pool.query<{ id: string }>("SELECT id FROM organizations");
      for (const org of orgs.rows) {
        for (const [name, limit] of serviceCatalogue) {
          await pool.query(
            `INSERT INTO services(id,organization_id,name,default_daily_limit) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [`svc-${crypto.randomUUID().slice(0, 8)}`, org.id, name, limit],
          );
        }
      }
      await pool.query("INSERT INTO activity_logs(id,action,metadata) VALUES ($1,'CATALOGUE_SYNC','{}') ON CONFLICT DO NOTHING", [CATALOGUE_MARKER]);

      // Seed Pro Apps dummy inventory items across all organizations
      const proAppsCheck = await pool.query("SELECT 1 FROM activity_logs WHERE id=$1 LIMIT 1", [PRO_APPS_SEED_MARKER]);
      if (proAppsCheck.rows.length === 0) {
        const orgList = await pool.query<{ id: string }>("SELECT id FROM organizations");
        for (const org of orgList.rows) {
          const svcRes = await pool.query<{ id: string }>(
            "SELECT id FROM services WHERE organization_id=$1 AND name IN ('Pro Apps', 'Adobe CC') ORDER BY CASE WHEN name='Pro Apps' THEN 1 ELSE 2 END LIMIT 1",
            [org.id]
          );
          if (svcRes.rows.length > 0) {
            const svcId = svcRes.rows[0].id;
            const dummyItems = [
              ["proapps.vip1@stockflow.app", "ProAppPass#2026", "JBSWY3DPEHPK3PXP", "https://2fa.live/tok/JBSWY3DPEHPK3PXP", "SHARED", 5],
              ["proapps.vip2@stockflow.app", "ProAppPass#2026", "JBSWY3DPEHPK3PXP", "https://2fa.live/tok/JBSWY3DPEHPK3PXP", "SHARED", 5],
              ["proapps.single1@stockflow.app", "ProAppPass#2026", "JBSWY3DPEHPK3PXP", "https://2fa.live/tok/JBSWY3DPEHPK3PXP", "INDIVIDUAL", 1],
              ["proapps.single2@stockflow.app", "ProAppPass#2026", "JBSWY3DPEHPK3PXP", "https://2fa.live/tok/JBSWY3DPEHPK3PXP", "INDIVIDUAL", 1],
              ["proapps.team@stockflow.app", "ProAppPass#2026", "JBSWY3DPEHPK3PXP", "https://2fa.live/tok/JBSWY3DPEHPK3PXP", "SHARED", 10],
            ];
            for (let i = 0; i < dummyItems.length; i++) {
              const [email, pwd, otpSecret, otpUrl, type, maxUsage] = dummyItems[i];
              await pool.query(
                `INSERT INTO inventory_items (id, organization_id, service_id, account_email, account_password, otp_secret, otp_url, account_type, max_usage, current_usage, status, expiry_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'AVAILABLE', '2026-12-31')
                 ON CONFLICT DO NOTHING`,
                [`INV-PA-${org.id.slice(0, 8)}-${i + 1}`, org.id, svcId, email, pwd, otpSecret, otpUrl, type, maxUsage]
              );
            }
          }
        }
        await pool.query("INSERT INTO activity_logs(id,action,metadata) VALUES ($1,'PRO_APPS_SEED','{}') ON CONFLICT DO NOTHING", [PRO_APPS_SEED_MARKER]);
      }
    })();
  }
  try {
    await globalThis.stockflowCatalogueReady;
    const pool=getPool();
    const seeded=await pool.query("SELECT 1 FROM activity_logs WHERE id=$1 LIMIT 1",[PRO_APPS_SEED_MARKER_V2]);
    if(!seeded.rows.length){
      const targets=await pool.query<{organization_id:string;service_id:string}>("SELECT organization_id,id AS service_id FROM services WHERE name='Pro Apps'");
      for(const target of targets.rows){
        const rows=[
          ["shared-team-01@demo.stockflow.app","SHARED",5,0],["shared-team-02@demo.stockflow.app","SHARED",5,2],
          ["shared-agency@demo.stockflow.app","SHARED",10,4],["individual-01@demo.stockflow.app","INDIVIDUAL",1,0],
          ["individual-02@demo.stockflow.app","INDIVIDUAL",1,0],["individual-03@demo.stockflow.app","INDIVIDUAL",1,0],
        ] as const;
        for(let index=0;index<rows.length;index++){
          const [email,type,maxUsage,currentUsage]=rows[index];
          await pool.query(`INSERT INTO inventory_items(id,organization_id,service_id,email,password,otp_secret,otp_url,account_type,max_usage,current_usage,status,expiry_date)
            VALUES($1,$2,$3,$4,'Demo@StockFlow2026','JBSWY3DPEHPK3PXP','https://2fa.live/tok/JBSWY3DPEHPK3PXP',$5,$6,$7,CASE WHEN $7>=$6 THEN 'FULL' ELSE 'AVAILABLE' END,'2026-12-31') ON CONFLICT DO NOTHING`,
            [`DEMO-PA-${target.organization_id.slice(0,8)}-${index+1}`,target.organization_id,target.service_id,email,type,maxUsage,currentUsage]);
        }
      }
      await pool.query("INSERT INTO activity_logs(id,action,metadata) VALUES($1,'PRO_APPS_DEMO_SEED',$2) ON CONFLICT DO NOTHING",[PRO_APPS_SEED_MARKER_V2,JSON.stringify({services:targets.rows.length})]);
    }
  } catch (error) {
    globalThis.stockflowCatalogueReady = undefined;
    throw error;
  }
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
