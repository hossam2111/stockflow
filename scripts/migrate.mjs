import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const migrationsUrl=new URL("../database/",import.meta.url);
const migrations=(await readdir(migrationsUrl)).filter((name)=>/^\d+_.+\.sql$/.test(name)).sort();
for(const migration of migrations){
  const sql=await readFile(new URL(migration,migrationsUrl),"utf8");
  await pool.query(sql);
  console.log(`Applied ${migration}`);
}
await pool.end();
console.log("StockFlow database migration completed.");
