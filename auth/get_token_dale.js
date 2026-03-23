/**
 * @deprecated Use: npm run get-token -- --user dale
 * Kept so existing docs and muscle memory still work.
 */
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(__dirname, "get_token.js"), "--user", "dale"], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
