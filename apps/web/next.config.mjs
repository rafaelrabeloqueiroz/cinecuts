/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cinecuts/db"],
  // Não usamos next/image; desativa a API de otimização de imagem para não
  // expor o endpoint /_next/image (alvo de CVEs conhecidas em builds 14.x).
  images: { unoptimized: true },
};

export default nextConfig;
