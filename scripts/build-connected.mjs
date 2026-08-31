import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./load-local-env.mjs";

if (!loadLocalEnv()) {
  console.error(".env.local がありません。先に npm run setup:local を実行してください。");
  process.exit(1);
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
for (const args of [["run", "export:live"], ["run", "build"]]) {
  const result = spawnSync(npm, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}

