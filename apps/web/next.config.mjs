import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Uma única fonte de verdade para as variáveis: o .env da raiz do monorepo.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(repoRoot, ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cinecuts/db", "@cinecuts/storage"],
  // Não usamos next/image; desativa a API de otimização de imagem para não
  // expor o endpoint /_next/image (alvo de CVEs conhecidas em builds 14.x).
  images: { unoptimized: true },
};

export default nextConfig;
