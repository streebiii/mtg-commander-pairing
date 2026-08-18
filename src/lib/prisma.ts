import { PrismaClient } from "@prisma/client";

// Next.js lädt Module in der Dev-Umgebung mehrfach neu (Hot Reload).
// Ohne diesen Singleton-Trick würden dabei immer neue PrismaClient-
// Instanzen (und damit neue DB-Connections) entstehen.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
