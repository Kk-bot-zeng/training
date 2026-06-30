import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || "file:dev.db";

  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    // PostgreSQL - used in production (Neon / Supabase)
    // Prisma 7 uses the built-in pg adapter when provider is postgresql
    return new PrismaClient();
  }

  // SQLite - used in local development
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
