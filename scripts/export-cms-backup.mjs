import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();
const url = String(process.env.SUPABASE_URL || "").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !serviceKey) {
  console.error("接続設定がありません。先に npm run setup:local を実行してください。");
  process.exit(1);
}
const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const tables = ["products", "news", "hero_features", "special_features"];
const content = { exportedAt: new Date().toISOString() };
for (const table of tables) {
  const result = await client.from(table).select("*");
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
  content[table] = result.data || [];
}
await mkdir("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = `backups/tsumugi-cms-${stamp}.json`;
await writeFile(file, JSON.stringify(content, null, 2) + "\n", { mode: 0o600 });
console.log(`${file} に商品・記事・特集だけを保存しました（注文・顧客・認証情報は含みません）。`);

