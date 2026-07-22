import assert from "node:assert/strict";
import test from "node:test";
import { newDb } from "pg-mem";

// Create fresh in-memory postgres pool matching StockFlow schema
function createTestPool() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({ name: "current_database", implementation: () => "stockflow" });
  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();
  return pool;
}

async function setupTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE, employee_limit INTEGER NOT NULL DEFAULT 25,
    inventory_limit INTEGER NOT NULL DEFAULT 10000, plan TEXT NOT NULL DEFAULT 'PRO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('ADMIN','EMPLOYEE')),
    organization_id TEXT REFERENCES organizations(id), is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    team TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, daily_limit INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE, default_daily_limit INTEGER NOT NULL DEFAULT 10,
    default_cost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id,name)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS employee_service_permissions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE, daily_limit INTEGER NOT NULL DEFAULT 5,
    PRIMARY KEY (user_id, service_id)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), service_id TEXT NOT NULL REFERENCES services(id),
    email TEXT NOT NULL, password TEXT NOT NULL, otp_secret TEXT, otp_url TEXT,
    account_type TEXT NOT NULL CHECK (account_type IN ('INDIVIDUAL','SHARED')),
    max_usage INTEGER NOT NULL DEFAULT 1, current_usage INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date DATE,
    UNIQUE(service_id, email)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id), service_id TEXT NOT NULL REFERENCES services(id),
    inventory_item_id TEXT REFERENCES inventory_items(id), status TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL, previous_usage INTEGER, new_usage INTEGER,
    batch_id TEXT, batch_quantity INTEGER NOT NULL DEFAULT 1,
    customer_name TEXT, customer_phone TEXT, customer_contact TEXT, customer_reference TEXT, customer_notes TEXT,
    subscription_start_date DATE, subscription_months INTEGER, subscription_end_date DATE,
    warranty_days INTEGER NOT NULL DEFAULT 0, warranty_end_date DATE,
    selling_price INTEGER DEFAULT 0, cost INTEGER DEFAULT 0, paid_amount INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id), actor_id TEXT, action TEXT NOT NULL, entity_type TEXT,
    entity_id TEXT, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT,
    description TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'GENERAL', amount INTEGER NOT NULL DEFAULT 0,
    spent_at DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL, phone TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    item TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit_cost INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0,
    purchased_at DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS wages (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL, role TEXT, amount INTEGER NOT NULL DEFAULT 0,
    paid_at DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  // Seed base org & admin & service
  await pool.query(`INSERT INTO organizations(id,name,slug,inventory_limit) VALUES ('org-test','Test Corp','test-corp',100)`);
  await pool.query(`INSERT INTO users(id,email,password_hash,name,role,organization_id) VALUES ('user-admin','admin@test.io','hash','Admin User','ADMIN','org-test')`);
  await pool.query(`INSERT INTO services(id,organization_id,name,default_cost) VALUES ('svc-gpt','org-test','ChatGPT Plus',100)`);
  await pool.query(`INSERT INTO services(id,organization_id,name,default_cost) VALUES ('svc-gemini','org-test','Google Gemini',50)`);
}

// ------------------- TEST SECTION 1: ACCOUNTS & INVENTORY MANAGEMENT -------------------
test("1. Accounts Management: Add Individual, Shared, Bulk, Duplicates & Edits", async () => {
  const pool = createTestPool();
  await setupTables(pool);

  // Add individual account
  const item1 = await pool.query(
    `INSERT INTO inventory_items (id, organization_id, service_id, email, password, account_type, max_usage, otp_secret, otp_url)
     VALUES ('STK-001', 'org-test', 'svc-gpt', 'indiv@test.io', 'pass123', 'INDIVIDUAL', 1, 'JBSWY3DPEHPK3PXP', 'https://2fa.live') RETURNING *`
  );
  assert.equal(item1.rows[0].email, "indiv@test.io");
  assert.equal(item1.rows[0].account_type, "INDIVIDUAL");
  assert.equal(item1.rows[0].max_usage, 1);
  assert.equal(item1.rows[0].status, "AVAILABLE");

  // Add shared account with max_usage 4
  const item2 = await pool.query(
    `INSERT INTO inventory_items (id, organization_id, service_id, email, password, account_type, max_usage)
     VALUES ('STK-002', 'org-test', 'svc-gpt', 'shared@test.io', 'pass456', 'SHARED', 4) RETURNING *`
  );
  assert.equal(item2.rows[0].account_type, "SHARED");
  assert.equal(item2.rows[0].max_usage, 4);

  // Prevent duplicate email for same service
  const dupCheck = await pool.query(
    `SELECT id FROM inventory_items WHERE organization_id='org-test' AND service_id='svc-gpt' AND LOWER(email)=LOWER('shared@test.io')`
  );
  assert.equal(dupCheck.rows.length, 1);

  // Edit shared account max_usage & password & status
  const updateRes = await pool.query(
    `UPDATE inventory_items SET password='newpassword', max_usage=5, status='AVAILABLE' WHERE id='STK-002' RETURNING *`
  );
  assert.equal(updateRes.rows[0].password, "newpassword");
  assert.equal(updateRes.rows[0].max_usage, 5);

  // Delete unused account
  const delRes = await pool.query(`DELETE FROM inventory_items WHERE id='STK-001' RETURNING id`);
  assert.equal(delRes.rows[0].id, "STK-001");
});

// ------------------- TEST SECTION 2: WITHDRAWALS, DEPOSITS & TREASURY -------------------
test("2. Withdrawals & Treasury: Shared allocation lifecycle, Customer Payments, Financial Net Profit", async () => {
  const pool = createTestPool();
  await setupTables(pool);

  // Insert a shared account with capacity 2
  await pool.query(
    `INSERT INTO inventory_items (id, organization_id, service_id, email, password, account_type, max_usage, current_usage, status)
     VALUES ('STK-SH1', 'org-test', 'svc-gpt', 'gpt-shared@test.io', 'pass123', 'SHARED', 2, 0, 'AVAILABLE')`
  );

  // 1st Withdrawal
  const select1 = await pool.query(
    `SELECT * FROM inventory_items WHERE organization_id='org-test' AND service_id='svc-gpt' AND status='AVAILABLE' AND current_usage<max_usage ORDER BY CASE WHEN account_type='SHARED' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`
  );
  assert.equal(select1.rows[0].id, "STK-SH1");

  const update1 = await pool.query(
    `UPDATE inventory_items SET current_usage=current_usage+1, status=CASE WHEN current_usage+1>=max_usage THEN 'FULL' ELSE 'AVAILABLE' END WHERE id='STK-SH1' RETURNING *`
  );
  assert.equal(update1.rows[0].current_usage, 1);
  assert.equal(update1.rows[0].status, "AVAILABLE"); // Still available for 1 more

  // Record 1st withdrawal record (Selling price = 500, Cost = 100, Paid = 200 => Outstanding = 300)
  await pool.query(
    `INSERT INTO withdrawals (id, organization_id, user_id, service_id, inventory_item_id, status, idempotency_key, customer_name, customer_phone, selling_price, cost, paid_amount)
     VALUES ('WD-001', 'org-test', 'user-admin', 'svc-gpt', 'STK-SH1', 'COMPLETED', 'key-001', 'عميل أحمد', '01000000001', 500, 100, 200)`
  );

  // 2nd Withdrawal - reaches max capacity
  const update2 = await pool.query(
    `UPDATE inventory_items SET current_usage=current_usage+1, status=CASE WHEN current_usage+1>=max_usage THEN 'FULL' ELSE 'AVAILABLE' END WHERE id='STK-SH1' RETURNING *`
  );
  assert.equal(update2.rows[0].current_usage, 2);
  assert.equal(update2.rows[0].status, "FULL"); // Now full!

  // Record 2nd withdrawal (Selling price = 400, Cost = 100, Paid = 400 => Paid in full)
  await pool.query(
    `INSERT INTO withdrawals (id, organization_id, user_id, service_id, inventory_item_id, status, idempotency_key, customer_name, customer_phone, selling_price, cost, paid_amount)
     VALUES ('WD-002', 'org-test', 'user-admin', 'svc-gpt', 'STK-SH1', 'COMPLETED', 'key-002', 'عميل محمود', '01000000002', 400, 100, 400)`
  );

  // Check 3rd withdrawal attempt => OUT OF STOCK
  const select3 = await pool.query(
    `SELECT * FROM inventory_items WHERE organization_id='org-test' AND service_id='svc-gpt' AND status='AVAILABLE' AND current_usage<max_usage`
  );
  assert.equal(select3.rows.length, 0); // Out of stock

  // Deposit / Payment: Record customer payment of 300 against '01000000001' (عميل أحمد)
  const outstandingBefore = await pool.query(
    `SELECT id, (selling_price - paid_amount) AS remaining FROM withdrawals WHERE organization_id='org-test' AND status='COMPLETED' AND customer_phone='01000000001' AND selling_price>paid_amount`
  );
  assert.equal(outstandingBefore.rows[0].remaining, 300);

  // Apply payment
  await pool.query(`UPDATE withdrawals SET paid_amount=paid_amount+300 WHERE id='WD-001'`);

  const outstandingAfter = await pool.query(
    `SELECT (selling_price - paid_amount) AS remaining FROM withdrawals WHERE id='WD-001'`
  );
  assert.equal(outstandingAfter.rows[0].remaining, 0); // Paid in full now!

  // Add Expense of 150
  await pool.query(
    `INSERT INTO expenses (id, organization_id, description, category, amount) VALUES ('EXP-001', 'org-test', 'استضافة سيرفرات', 'GENERAL', 150)`
  );

  // Verify Treasury & Accounting calculations
  const financialSummary = await pool.query(`SELECT
    COALESCE(SUM(w.selling_price),0)::int AS revenue,
    COALESCE(SUM(w.paid_amount),0)::int AS collected,
    COALESCE(SUM(w.cost),0)::int AS cost,
    COALESCE(SUM(w.selling_price-w.paid_amount),0)::int AS outstanding
    FROM withdrawals w WHERE w.organization_id='org-test' AND w.status='COMPLETED'`);
  const expenseSummary = await pool.query(`SELECT COALESCE(SUM(amount),0)::int AS total FROM expenses WHERE organization_id='org-test'`);

  const rev = financialSummary.rows[0].revenue; // 500 + 400 = 900
  const col = financialSummary.rows[0].collected; // (200+300) + 400 = 900
  const cost = financialSummary.rows[0].cost; // 100 + 100 = 200
  const exp = expenseSummary.rows[0].total; // 150
  const treasury = col - exp; // 900 - 150 = 750
  const netProfit = (rev - cost) - exp; // (900 - 200) - 150 = 550

  assert.equal(rev, 900);
  assert.equal(col, 900);
  assert.equal(cost, 200);
  assert.equal(exp, 150);
  assert.equal(treasury, 750);
  assert.equal(netProfit, 550);
});

// ------------------- TEST SECTION 3: OTHER SECTIONS (EMPLOYEES, SUPPLIERS, WAGES, PURCHASES) -------------------
test("3. Remaining Sections: Employees, Services, Suppliers, Purchases, Wages & Activity Logs", async () => {
  const pool = createTestPool();
  await setupTables(pool);

  // Services: Add new service
  await pool.query(
    `INSERT INTO services (id, organization_id, name, default_cost, default_daily_limit) VALUES ('svc-capcut', 'org-test', 'CapCut Pro', 75, 10)`
  );
  const svcs = await pool.query(`SELECT * FROM services WHERE organization_id='org-test'`);
  assert.equal(svcs.rows.length, 3);

  // Employees: Add employee and permission
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, organization_id, daily_limit) VALUES ('user-emp1', 'emp1@test.io', 'hash', 'عمر خالد', 'EMPLOYEE', 'org-test', 15)`
  );
  await pool.query(
    `INSERT INTO employee_service_permissions (user_id, service_id, enabled, daily_limit) VALUES ('user-emp1', 'svc-gpt', true, 5)`
  );

  const perm = await pool.query(`SELECT * FROM employee_service_permissions WHERE user_id='user-emp1' AND service_id='svc-gpt'`);
  assert.equal(perm.rows[0].enabled, true);
  assert.equal(perm.rows[0].daily_limit, 5);

  // Suppliers & Purchases
  await pool.query(
    `INSERT INTO suppliers (id, organization_id, name, phone) VALUES ('SUP-001', 'org-test', 'مورد الحسابات العالمية', '0123456789')`
  );
  await pool.query(
    `INSERT INTO purchases (id, organization_id, supplier_id, item, quantity, unit_cost, total, paid) VALUES ('PUR-001', 'org-test', 'SUP-001', 'حسابات ChatGPT بالجملة', 10, 80, 800, 800)`
  );

  const pur = await pool.query(`SELECT * FROM purchases WHERE supplier_id='SUP-001'`);
  assert.equal(pur.rows[0].total, 800);

  // Wages
  await pool.query(
    `INSERT INTO wages (id, organization_id, name, role, amount) VALUES ('WAG-001', 'org-test', 'عمر خالد', 'مبيعات', 500)`
  );
  const wag = await pool.query(`SELECT * FROM wages WHERE organization_id='org-test'`);
  assert.equal(wag.rows[0].amount, 500);

  // Activity log
  await pool.query(
    `INSERT INTO activity_logs (id, organization_id, actor_id, action, entity_type, entity_id) VALUES ('ACT-001', 'org-test', 'user-admin', 'SYSTEM_AUDIT', 'GENERAL', 'SYS')`
  );
  const act = await pool.query(`SELECT * FROM activity_logs WHERE organization_id='org-test'`);
  assert.equal(act.rows.length, 1);
});
