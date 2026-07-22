import { query } from "../lib/db.ts";

async function clearData() {
  console.log("Clearing all dummy inventory, withdrawals, expenses, purchases, wages, and activity logs...");
  await query("TRUNCATE TABLE withdrawals CASCADE");
  await query("TRUNCATE TABLE inventory_items CASCADE");
  await query("TRUNCATE TABLE expenses CASCADE");
  await query("TRUNCATE TABLE purchases CASCADE");
  await query("TRUNCATE TABLE wages CASCADE");
  await query("TRUNCATE TABLE suppliers CASCADE");
  await query("DELETE FROM activity_logs WHERE id != 'seed-complete-v1'");
  console.log("All dummy data successfully cleared!");
  process.exit(0);
}

clearData().catch((err) => {
  console.error("Error clearing data:", err);
  process.exit(1);
});
