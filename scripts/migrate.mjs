import pg from "pg";
import { readFile } from "node:fs/promises";
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const sql=await readFile(new URL("../database/001_initial.sql",import.meta.url),"utf8");
await pool.query(sql);
await pool.end();
console.log("StockFlow database migration completed.");
