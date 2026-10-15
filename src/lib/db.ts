import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { config } from './config';

// One client per process; reused across dev hot reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/** The client inside `db.$transaction(async (tx) => …)`. Services that may run inside a caller's transaction take `tx = db`. */
export type Tx = Prisma.TransactionClient;

/** Unique-constraint violation (duplicate key) — how we detect "already processed". */
export const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
