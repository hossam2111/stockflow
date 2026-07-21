import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { newDb } from "pg-mem";

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
    selling_price INTEGER DEFAULT 0,
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
  "selling_price INTEGER DEFAULT 0",
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

      // Serverless cold starts re-run this IIFE on every fresh instance. Creating the schema and
      // running the ~85-query data seed on each one makes the first login slow enough to time out on
      // Neon. Once a previous run has written the completion marker we skip the whole setup and this
      // becomes a single round-trip. Databases left half-seeded by an earlier crash have no marker,
      // so they simply re-run the (idempotent) seed once more and then get marked complete.
      try {
        const seeded = await pool.query("SELECT 1 FROM activity_logs WHERE id='seed-complete-v1' LIMIT 1");
        if (seeded.rows.length > 0) return;
      } catch {
        // activity_logs does not exist yet on a brand-new database — fall through to full setup.
      }

      for (const statement of schema) await pool.query(statement);

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

      // Inventory
      const inventory = [
        ["STK-2048","chatgpt","client28@vault.io","V@ult#9281","JBSWY3DPEHPK3PXP","https://2fa.live","SHARED",5,3],
        ["STK-2049","chatgpt","gpt-team1@stockflow.io","Gpt#Pass99","","","SHARED",10,5],
        ["STK-2050","chatgpt","premium-user1@outlook.com","PassWord#88","","","INDIVIDUAL",1,1],
        ["STK-2047","adobe","design91@vault.io","Adobe#441","KRSXG5DSNFXGC4TF","https://2fa.live","INDIVIDUAL",1,0],
        ["STK-2051","adobe","creative-studio@gmail.com","StudioAdobe2026","","","INDIVIDUAL",1,0],
        ["STK-2046","canva","canva17@vault.io","Canva!778","MZXW6YTBOI======","https://totp.danhersam.com","SHARED",5,4],
        ["STK-2052","canva","canva-design2@stockflow.io","Canva#Pass55","","","SHARED",5,0],
        ["STK-2044","claude","claude-pro1@vault.io","Claude#12345","","","INDIVIDUAL",1,0],
        ["STK-2053","claude","anthropic-ai@outlook.com","Anthropic#898","","","INDIVIDUAL",1,0],
        ["STK-2054","perplexity","pro08@vault.io","Perp!2026","ONSWG4TFORUGS4ZA","https://totp.danhersam.com","SHARED",5,2],
        ["STK-2055","perplexity","search-master@gmail.com","Search#2026","","","SHARED",5,0],
        ["STK-2056","midjourney","mj-art1@stockflow.io","MjArtPass#77","","","INDIVIDUAL",1,0],
        ["STK-2057","midjourney","mj-render2@stockflow.io","MjRenderPass#66","","","INDIVIDUAL",1,1],
        ["STK-2058","spotify","music-family1@gmail.com","Spotify#Family1","","","SHARED",6,2],
        ["STK-2059","spotify","premium-listen@outlook.com","MusicLover2026","","","SHARED",6,0],
        ["STK-2060","netflix","movie-night1@outlook.com","Netflix#Pass1","","","SHARED",4,2],
        ["STK-2061","netflix","netflix-shared@gmail.com","Netflix#Pass2","","","SHARED",4,4],
        ["STK-2062","github","copilot-dev1@stockflow.io","Copilot#Dev1","","","INDIVIDUAL",1,0],
        ["STK-2063","github","copilot-dev2@stockflow.io","Copilot#Dev2","","","INDIVIDUAL",1,0]
      ];
      
      for (const item of inventory) {
        const maxUsage = item[7] as number;
        const currentUsage = item[8] as number;
        const status = currentUsage >= maxUsage ? 'FULL' : 'AVAILABLE';
        await pool.query(`INSERT INTO inventory_items
          (id,organization_id,service_id,email,password,otp_secret,otp_url,account_type,max_usage,current_usage,status)
          VALUES ($1,'org-demo',$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [...item, status]);
      }

      // Seed Inventory for org-innovate
      const innovateInventory = [
        ["STK-IN-1001","svc-in-chatgpt","innovate-gpt1@gmail.com","Pass#Gpt1","","","SHARED",5,1],
        ["STK-IN-1002","svc-in-adobe","innovate-adobe1@gmail.com","Pass#Adobe1","","","INDIVIDUAL",1,0],
        ["STK-IN-1003","svc-in-claude","innovate-claude1@gmail.com","Pass#Claude1","","","INDIVIDUAL",1,0]
      ];
      for (const item of innovateInventory) {
        const maxUsage = item[7] as number;
        const currentUsage = item[8] as number;
        const status = currentUsage >= maxUsage ? 'FULL' : 'AVAILABLE';
        await pool.query(`INSERT INTO inventory_items
          (id,organization_id,service_id,email,password,otp_secret,otp_url,account_type,max_usage,current_usage,status)
          VALUES ($1,'org-innovate',$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [...item, status]);
      }

      // Seed historical withdrawals (for dashboard trends and logs)
      const withdrawals = [
        ["WD-HIST-1", "org-demo", "omar", "chatgpt", "STK-2048", "COMPLETED", "key-hist-1", 0, 1, "BATCH-HIST-1", 1, "أحمد رأفت", "01011111111", "whatsapp", "REF-001", "اشتراك تجريبي لمشاهدة الخدمة", "2026-07-16", 1, "2026-08-16", 0, null, "5 days"],
        ["WD-HIST-2", "org-demo", "youssef", "canva", "STK-2046", "COMPLETED", "key-hist-2", 0, 1, "BATCH-HIST-2", 1, "منى زكي", "01122222222", "telegram", "REF-002", "عميل دائم", "2026-07-17", 3, "2026-10-17", 7, "2026-07-24", "4 days"],
        ["WD-HIST-3", "org-demo", "fatima", "adobe", "STK-2047", "COMPLETED", "key-hist-3", 0, 1, "BATCH-HIST-3", 1, "كريم عبد العزيز", "01233333333", "messenger", "REF-003", "حساب فردي للتصميم", "2026-07-18", 1, "2026-08-18", 0, null, "3 days"],
        ["WD-HIST-4", "org-demo", "omar", "claude", "STK-2053", "COMPLETED", "key-hist-4", 0, 1, "BATCH-HIST-4", 1, "محمد رمضان", "01544444444", "email", "REF-004", "مطور برمجيات", "2026-07-19", 1, "2026-08-19", 15, "2026-08-03", "2 days"],
        ["WD-HIST-5", "org-demo", "youssef", "spotify", "STK-2058", "COMPLETED", "key-hist-5", 0, 1, "BATCH-HIST-5", 1, "عمرو دياب", "01055555555", "whatsapp", "REF-005", "اشتراك عائلي", "2026-07-20", 6, "2027-01-20", 0, null, "1 day"],
        ["WD-HIST-6", "org-demo", "fatima", "netflix", "STK-2060", "COMPLETED", "key-hist-6", 0, 1, "BATCH-HIST-6", 1, "أحمد السقا", "01166666666", "phone", "REF-006", "باقة الترا 4K", "2026-07-21", 1, "2026-08-21", 3, "2026-07-24", "12 hours"],
        ["WD-HIST-7", "org-demo", "omar", "perplexity", "STK-2054", "COMPLETED", "key-hist-7", 0, 1, "BATCH-HIST-7", 1, "تامر حسني", "01277777777", "instagram", "REF-007", "باحث أكاديمي", "2026-07-21", 12, "2027-07-21", 30, "2026-08-20", "2 hours"]
      ];

      for (const wd of withdrawals) {
        // A drifted database may not contain the exact inventory id this demo row references (e.g. the
        // slot was taken by an earlier row with a different id). Insert only when the referenced item
        // exists so the seed never trips the inventory foreign key and can finish + mark itself done.
        await pool.query(`INSERT INTO withdrawals(
          id,organization_id,user_id,service_id,inventory_item_id,status,idempotency_key,previous_usage,new_usage,batch_id,batch_quantity,
          customer_name,customer_phone,customer_contact,customer_reference,customer_notes,
          subscription_start_date,subscription_months,subscription_end_date,warranty_days,warranty_end_date,created_at)
          SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW() - $22::INTERVAL
          WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id=$5) ON CONFLICT DO NOTHING`, wd);
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
      for (const [table, definitions] of Object.entries({ ...tenantColumns, inventory_items: [...tenantColumns.inventory_items, "expiry_date DATE"], withdrawals: withdrawalColumns })) {
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
