import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderStatusGuardSql } from "../src/domain/status-sql.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "db", "order_status_guard.sql");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, renderStatusGuardSql());
console.log(`wrote ${target}`);
