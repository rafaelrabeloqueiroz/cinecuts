import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// O worker pode ser iniciado da raiz do monorepo ou de apps/worker; nos dois
// casos as variáveis vêm do mesmo .env da raiz.
for (const candidate of [resolve(process.cwd(), ".env"), resolve(__dirname, "../../../../.env")]) {
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
}
