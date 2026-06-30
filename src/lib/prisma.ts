import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL!;

  // PostgreSQL (Neon/Supabase)
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    const pool = new Pool({ connectionString: url });
    globalForPrisma.pool = pool;
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  // Fallback
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
