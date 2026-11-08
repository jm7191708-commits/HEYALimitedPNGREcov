import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const lockedKeys = new Set(Object.keys(process.env));
const candidateFiles = [
  ".env",
  ".env.local",
  ".env.render",
  ".env.render.local"
];

for (const fileName of candidateFiles) {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) {
    continue;
  }

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (lockedKeys.has(key)) {
      continue;
    }
    process.env[key] = value;
  }
}
