import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Enterprise Supabase + Prisma 7 Singleton Client
 *
 * Uses Supabase Supavisor Transaction Pooler (Port 6543) for runtime queries
 * with controlled per-instance connection pooling to prevent connection exhaustion
 * across serverless/edge invocations.
 */
const prismaClientSingleton = () => {
  const rawConnectionString =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL;

  if (!rawConnectionString) {
    console.warn(
      "[Prisma] WARNING: DATABASE_URL / POSTGRES_PRISMA_URL is not set in environment variables."
    );
  }

  // Strip Prisma-specific query params that node-postgres (pg) does not natively parse
  const connectionString = (rawConnectionString || "")
    .replace(/([?&])sslmode=[^&]*/g, "$1")
    .replace(/([?&])pgbouncer=[^&]*/g, "$1")
    .replace(/([?&])supa=[^&]*/g, "$1")
    .replace(/([?&])connection_limit=[^&]*/g, "$1")
    .replace(/([?&])pool_timeout=[^&]*/g, "$1")
    .replace(/[?&]+$/, "")
    .replace(/\?&/, "?")
    .replace(/&&+/g, "&");

  const isLocalhost =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  // Default to 10 connections max per instance for Supabase Supavisor compatibility
  const maxConnections = parseInt(process.env.DB_POOL_MAX || "10", 10);

  const pool = new pg.Pool({
    connectionString: connectionString || undefined,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500, // Recycle connections periodically for Supabase pooler health
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  pool.on("error", (err) => {
    console.error("[Supabase PG Pool] Unexpected error on idle client:", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();
export default prisma;

// Cache singleton in globalThis across both dev HMR and warm serverless invocations
globalThis.prisma = prisma;

