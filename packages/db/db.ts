import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

export const db = new Database(join(import.meta.dir, "data", "wiz-nas.sqlite"), { strict: true, create: true });

db.query("PRAGMA journal_mode = WAL").run();
db.query("PRAGMA foreign_keys = ON").run();

const schema = readFileSync(join(import.meta.dir, "schema.sql"), "utf8");
for (const stmt of schema.split(/\r?\n\r?\n/).map(s => s.trim()).filter(Boolean)) {
    db.query(stmt.endsWith(";") ? stmt : stmt + ";").run();
}
