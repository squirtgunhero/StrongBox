import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: "strong-investor-loans" },
    update: {},
    create: {
      name: "Strong Investor Loans",
      slug: "strong-investor-loans",
      settings: {
        defaultInterestRate: 12.0,
        defaultTermMonths: 12,
        defaultOriginationFee: 2.0,
        dayCountConvention: "actual/360",
        lateFeeGraceDays: 10,
        lateFeePercent: 5.0,
        defaultDaysDelinquent: 90,
      },
    },
  });

  console.log(`Created organization: ${org.name} (${org.id})`);
  console.log("Seeding complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
