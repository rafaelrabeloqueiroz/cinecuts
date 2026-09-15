import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD não definidos — pulando criação de admin.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role: "ADMIN" },
    create: { email: email.toLowerCase(), name: "Admin", passwordHash, role: "ADMIN" },
  });

  console.log(`Admin pronto: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
