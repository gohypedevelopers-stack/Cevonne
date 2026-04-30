import { PrismaClient } from "@prisma/client/wasm";

const prisma = new PrismaClient();

async function main() {
  await prisma.collection.create({
    data: { name: "Lips", slug: "lips" },
  });
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
