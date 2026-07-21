// Integration test for the core allocation logic used by app/api/withdrawals/route.ts.
// It runs the EXACT SELECT/UPDATE queries the withdrawal handler uses against an in-memory
// Postgres (pg-mem), so no real data is touched. It proves how INDIVIDUAL and SHARED accounts
// are consumed: a SHARED account stays available for exactly `max_usage` withdrawals before the
// next account is used, and an INDIVIDUAL account is single-use.
import assert from "node:assert/strict";
import test from "node:test";
import { newDb } from "pg-mem";

// Verbatim from app/api/withdrawals/route.ts (memory DB omits FOR UPDATE SKIP LOCKED).
const SELECT_ITEM = `SELECT * FROM inventory_items WHERE organization_id=$1 AND service_id=$2
  AND status='AVAILABLE' AND current_usage<max_usage
  ORDER BY CASE WHEN account_type='SHARED' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`;
const UPDATE_ITEM = `UPDATE inventory_items SET current_usage=current_usage+1,status=CASE WHEN current_usage+1>=max_usage THEN 'FULL' ELSE 'AVAILABLE' END WHERE id=$1 AND current_usage<max_usage RETURNING *`;

function freshPool() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  return pool;
}

async function setup(pool) {
  await pool.query(`CREATE TABLE inventory_items (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, service_id TEXT NOT NULL,
    email TEXT NOT NULL, account_type TEXT NOT NULL,
    max_usage INTEGER NOT NULL DEFAULT 1, current_usage INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

// Simulate one single-quantity withdrawal the same way the route's loop body does.
async function allocateOne(pool) {
  const found = await pool.query(SELECT_ITEM, ["org-demo", "chatgpt"]);
  const item = found.rows[0];
  if (!item) return { error: "OUT_OF_STOCK" };
  const updated = await pool.query(UPDATE_ITEM, [item.id]);
  return { id: item.id, accountType: item.account_type, newUsage: updated.rows[0].current_usage, status: updated.rows[0].status };
}

test("SHARED account is consumed max_usage times before moving on; INDIVIDUAL is single-use", async () => {
  const pool = freshPool();
  await setup(pool);
  // One shared account with capacity 3 (created first => picked first), then one individual account.
  await pool.query(`INSERT INTO inventory_items(id,organization_id,service_id,email,account_type,max_usage,current_usage,status,created_at)
    VALUES ('SHARED-A','org-demo','chatgpt','shared@x.io','SHARED',3,0,'AVAILABLE', NOW() - INTERVAL '10 minutes')`);
  await pool.query(`INSERT INTO inventory_items(id,organization_id,service_id,email,account_type,max_usage,current_usage,status,created_at)
    VALUES ('INDIV-B','org-demo','chatgpt','indiv@x.io','INDIVIDUAL',1,0,'AVAILABLE', NOW() - INTERVAL '5 minutes')`);

  const results = [];
  for (let i = 0; i < 5; i++) results.push(await allocateOne(pool));

  // Withdrawals 1..3 all hit the shared account, usage climbing 1,2,3; FULL only at capacity.
  assert.deepEqual(results[0], { id: "SHARED-A", accountType: "SHARED", newUsage: 1, status: "AVAILABLE" });
  assert.deepEqual(results[1], { id: "SHARED-A", accountType: "SHARED", newUsage: 2, status: "AVAILABLE" });
  assert.deepEqual(results[2], { id: "SHARED-A", accountType: "SHARED", newUsage: 3, status: "FULL" });
  // 4th withdrawal moves to the individual account, which becomes FULL immediately (single use).
  assert.deepEqual(results[3], { id: "INDIV-B", accountType: "INDIVIDUAL", newUsage: 1, status: "FULL" });
  // 5th withdrawal: nothing left.
  assert.deepEqual(results[4], { error: "OUT_OF_STOCK" });
});

test("a SHARED account that has already reached capacity is never picked", async () => {
  const pool = freshPool();
  await setup(pool);
  await pool.query(`INSERT INTO inventory_items(id,organization_id,service_id,email,account_type,max_usage,current_usage,status,created_at)
    VALUES ('SHARED-FULL','org-demo','chatgpt','full@x.io','SHARED',5,5,'FULL', NOW() - INTERVAL '10 minutes')`);
  await pool.query(`INSERT INTO inventory_items(id,organization_id,service_id,email,account_type,max_usage,current_usage,status,created_at)
    VALUES ('SHARED-OPEN','org-demo','chatgpt','open@x.io','SHARED',2,0,'AVAILABLE', NOW() - INTERVAL '5 minutes')`);

  const a = await allocateOne(pool);
  const b = await allocateOne(pool);
  const c = await allocateOne(pool);
  assert.deepEqual(a, { id: "SHARED-OPEN", accountType: "SHARED", newUsage: 1, status: "AVAILABLE" });
  assert.deepEqual(b, { id: "SHARED-OPEN", accountType: "SHARED", newUsage: 2, status: "FULL" });
  assert.deepEqual(c, { error: "OUT_OF_STOCK" });
});

test("mixed capacity: two shared accounts are drained oldest-first, each to its own max_usage", async () => {
  const pool = freshPool();
  await setup(pool);
  await pool.query(`INSERT INTO inventory_items(id,organization_id,service_id,email,account_type,max_usage,current_usage,status,created_at)
    VALUES ('SHARED-1','org-demo','chatgpt','s1@x.io','SHARED',2,0,'AVAILABLE', NOW() - INTERVAL '10 minutes')`);
  await pool.query(`INSERT INTO inventory_items(id,organization_id,service_id,email,account_type,max_usage,current_usage,status,created_at)
    VALUES ('SHARED-2','org-demo','chatgpt','s2@x.io','SHARED',2,0,'AVAILABLE', NOW() - INTERVAL '5 minutes')`);

  const ids = [];
  for (let i = 0; i < 4; i++) ids.push((await allocateOne(pool)).id);
  assert.deepEqual(ids, ["SHARED-1", "SHARED-1", "SHARED-2", "SHARED-2"]);
});
