import { existsSync, readFileSync } from "node:fs";

// Tiny dependency-free .env.local reader for the one-time setup and backup
// commands. Existing shell/CI variables always win.
export function loadLocalEnv(file = ".env.local") {
  if (!existsSync(file)) return false;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!Object.hasOwn(process.env, key)) process.env[key] = value;
  }
  return true;
}

