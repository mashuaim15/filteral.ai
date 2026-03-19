import { PrismaClient, Tier } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin" },
    update: {},
    create: {
      id: "admin000000000000000000000",
      email: "admin",
      passwordHash: "admin",
      name: "Admin",
      subscriptionTier: Tier.PRO,
    },
  });
  console.log("Seeded admin user: admin / admin (PRO)");
}

main().finally(() => prisma.$disconnect());
