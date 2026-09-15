import { PrismaClient } from "../generated/client";

declare global {
  // eslint-disable-next-line no-var
  var __cinecutsPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__cinecutsPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__cinecutsPrisma = prisma;
}

export * from "../generated/client";
