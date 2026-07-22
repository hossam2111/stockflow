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
  assert.match(page, /sep=,\\r\\n/);
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
  assert.match(inventory, /requireWorkspaceAdmin/);
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
  assert.match(sales, /requireWorkspaceAdmin/);
  assert.match(sales, /source,service_name,item_description/);
  assert.match(sales, /WHERE id=\$12 AND organization_id=\$13/);
  assert.match(withdrawals, /INSERT INTO sales/);
  assert.match(withdrawals, /'WITHDRAWAL'/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS sales/);
});
