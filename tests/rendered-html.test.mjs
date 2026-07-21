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
