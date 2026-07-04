import { getDb } from "./sync-db.mjs";
const db = getDb();

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
for (const t of tables) {
  console.log("\n=== " + t.name + " ===");
  const cols = db.pragma("table_info(" + t.name + ")");
  for (const c of cols) {
    const pk = c.pk ? " PK" + c.pk : "";
    const nn = c.notnull ? " NOT NULL" : "";
    const def = c.dflt_value != null ? " DEFAULT " + c.dflt_value : "";
    console.log("  " + c.name + " " + c.type + pk + nn + def);
  }
  const fks = db.pragma("foreign_key_list(" + t.name + ")");
  if (fks.length) {
    console.log("  FK:");
    for (const fk of fks) console.log("    " + fk.from + " -> " + fk.table + "(" + fk.to + ") ON DELETE " + fk.on_delete);
  }
  const idxs = db.pragma("index_list(" + t.name + ")");
  if (idxs.length) {
    console.log("  IDX:");
    for (const idx of idxs) {
      const info = db.pragma("index_info(" + idx.name + ")");
      console.log("    [" + (idx.unique ? "UNIQUE " : "") + info.map(i => i.name).join(", ") + "] " + idx.name);
    }
  }
  const count = db.prepare("SELECT COUNT(*) as n FROM [" + t.name + "]").get();
  console.log("  Rows: " + count.n);
}
