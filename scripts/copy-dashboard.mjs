import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src", "dashboard");
const dstDir = path.join(root, "dist", "dashboard");

fs.mkdirSync(dstDir, { recursive: true });
for (const name of fs.readdirSync(srcDir)) {
  fs.copyFileSync(path.join(srcDir, name), path.join(dstDir, name));
}
