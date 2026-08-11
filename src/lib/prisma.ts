import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL!;
  const poolMax = Math.max(5, Math.min(40, Number(process.env.DATABASE_POOL_MAX) || 20));
  const adapter = process.env.DATABASE_ADAPTER === "pg"
    ? new PrismaPg({
        connectionString: url,
        max: poolMax,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      })
    : new PrismaNeon({ connectionString: url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
