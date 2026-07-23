import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("contains the complete Arabic StockFlow application shell", async () => {
  const [page, layout] = await Promise.all([read("app/page.tsx"), read("app/layout.tsx")]);
  assert.match(layout, /StockFlow/);
  assert.match(page, /رفع Excel \/ CSV \/ TXT/);
  assert.match(page, /مفتاح OTP/);
  assert.match(page, /موقع استخراج OTP/);
  assert.match(page, /الخدمات المسموح بها/);
  assert.match(page, /الحد اليومي للموظف/);
  assert.match(page, /نسخ الرسالة كاملة/);
});

test("protects withdrawals with permissions and atomic allocation", async () => {
  const [withdrawals, access, inventory] = await Promise.all([
    read("app/api/withdrawals/route.ts"),
    read("app/api/employee-access/route.ts"),
    read("app/api/inventory/route.ts"),
  ]);
  assert.match(withdrawals, /transaction\(async client/);
  assert.match(withdrawals, /FOR UPDATE SKIP LOCKED/);
  assert.match(withdrawals, /idempotency_key/);
  assert.match(withdrawals, /SERVICE_NOT_ALLOWED/);
  assert.match(withdrawals, /DAILY_LIMIT_REACHED/);
  assert.match(access, /employee_service_permissions/);
  assert.match(inventory, /INVENTORY_IMPORT/);
});

test("keeps shared accounts available until their capacity is full", async () => {
  const [page, withdrawals, services] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/withdrawals/route.ts"),
    read("app/api/services/route.ts"),
  ]);

  assert.match(withdrawals, /current_usage\s*<\s*max_usage/);
  assert.match(withdrawals, /current_usage\+1>=max_usage THEN 'FULL' ELSE 'AVAILABLE'/);
  assert.match(withdrawals, /existingCredential\.allocatedUses\+=1/);
  assert.match(withdrawals, /remainingUsage:Math\.max\(0,updatedItem\.max_usage-updatedItem\.current_usage\)/);
  assert.match(services, /available_shared_slots/);
  assert.match(services, /available_individual_accounts/);
  assert.match(page, /عدد مرات سحب الإيميل المشترك/);
  assert.match(page, /الحساب ما زال متاحًا/);
  assert.match(page, /اكتمل الحد الأقصى/);
});

test("exports Excel-compatible UTF-8 CSV and complete withdrawal/customer data", async () => {
  const [page, withdrawals] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/withdrawals/route.ts"),
  ]);
  assert.match(page, /exportToExcel/);
  assert.match(page, /doc\.save\(`\$\{safeName\}\.pdf`\)/);
  assert.match(page, /jspdf-autotable/);
  assert.doesNotMatch(page, /window\.print\(\)/);
  assert.match(page, /customer_notes/);
  assert.match(page, /account_password/);
  assert.match(page, /previous_usage/);
  assert.match(withdrawals, /i\.email AS account_email/);
  assert.match(withdrawals, /i\.password AS account_password/);
  assert.match(withdrawals, /w\.batch_id/);
});

test("stores a separate encrypted OpenAI connection for each admin", async () => {
  const [route, credentials, database] = await Promise.all([
    read("app/api/ai-connection/route.ts"),
    read("lib/ai-credentials.ts"),
    read("lib/db.ts"),
  ]);
  assert.match(route, /requireWorkspaceAdmin/);
  assert.match(route, /ON CONFLICT\(user_id\)/);
  assert.doesNotMatch(route, /decryptApiKey/);
  assert.match(credentials, /aes-256-gcm/);
  assert.match(credentials, /Authorization: `Bearer \$\{apiKey\}`/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS ai_connections/);
});

test("isolates every admin inventory operation to their own organization", async () => {
  const inventory = await read("app/api/inventory/route.ts");
  assert.match(inventory, /requireWorkspacePermission\("inventory\.view"\)/);
  assert.match(inventory, /requireWorkspacePermission\("inventory\.manage"\)/);
  assert.match(inventory, /i\.organization_id=\$1/);
  assert.match(inventory, /SELECT id FROM services WHERE id=\$1 AND organization_id=\$2/);
  assert.match(inventory, /WHERE id=\$1 AND organization_id=\$2 FOR UPDATE/);
  assert.match(inventory, /DELETE FROM inventory_items WHERE id=\$1 AND organization_id=\$2/);
  assert.match(inventory, /context\.organizationId,item\.serviceId,item\.email/);
});

test("records withdrawals in an editable sales ledger and supports manual sales", async () => {
  const [page, sales, withdrawals, database] = await Promise.all([
    read("app/page.tsx"), read("app/api/sales/route.ts"),
    read("app/api/withdrawals/route.ts"), read("lib/db.ts"),
  ]);
  assert.match(page, /view === "sales"/);
  assert.match(page, /method:editing\?"PATCH":"POST"/);
  assert.match(sales, /requireWorkspacePermission\("sales\.view_all"\)/);
  assert.match(sales, /requireWorkspacePermission\("sales\.manage"\)/);
  assert.match(sales, /source,service_name,item_description/);
  assert.match(sales, /WHERE id=\$11 AND organization_id=\$12/);
  assert.doesNotMatch(page, /بيان المبيعة/);
  assert.match(withdrawals, /INSERT INTO sales/);
  assert.match(withdrawals, /'WITHDRAWAL'/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS sales/);
});

test("keeps employees limited and grants accounting access explicitly per organization", async () => {
  const [page, auth, employees, accounting, expenses] = await Promise.all([
    read("app/page.tsx"), read("lib/auth.ts"), read("app/api/employees/[id]/route.ts"),
    read("app/api/accounting/route.ts"), read("app/api/expenses/route.ts"),
  ]);
  assert.match(page, /currentUser\?\.permissions/);
  assert.match(page, /الدور الوظيفي والصلاحيات/);
  assert.match(auth, /requireWorkspacePermission/);
  assert.match(auth, /organization_id=\$2/);
  assert.match(employees, /can_manage_accounting/);
  assert.match(accounting, /requireWorkspacePermission\("accounting\.view"\)/);
  assert.match(expenses, /requireWorkspacePermission\("accounting\.(view|manage)"\)/);
});

test("persists organization settings and applies allocation policy server-side",async()=>{
  const [page,settings,withdrawals,database]=await Promise.all([read("app/page.tsx"),read("app/api/settings/route.ts"),read("app/api/withdrawals/route.ts"),read("lib/db.ts")]);
  assert.match(page,/fetch\("\/api\/settings"/);
  assert.doesNotMatch(page,/stockflow-settings/);
  assert.match(settings,/organization_settings/);
  assert.match(settings,/requireWorkspacePermission\("settings\.manage"\)/);
  assert.match(withdrawals,/allocation_strategy/);
  assert.match(withdrawals,/allow_shared_accounts/);
  assert.match(database,/CREATE TABLE IF NOT EXISTS user_permissions/);
  assert.match(database,/CREATE TABLE IF NOT EXISTS organization_settings/);
});

test("closes global search results on outside click and Escape",async()=>{
  const page=await read("app/page.tsx");
  assert.match(page,/globalSearchRef\.current\?\.contains/);
  assert.match(page,/document\.addEventListener\("pointerdown",closeOnOutside\)/);
  assert.match(page,/event\.key==="Escape"/);
  assert.match(page,/query && searchOpen/);
});
