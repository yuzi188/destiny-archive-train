import { Pool, type QueryResultRow } from "pg";

export type ClaimJobStatus = "queued" | "generating" | "sent" | "error";

export type ClaimJob = {
  id: string;
  status: ClaimJobStatus;
  productId?: string;
  planName?: string;
  recipient: string;
  passengerName: string;
  message: string;
  error?: string;
  payload?: unknown;
  fullSubject?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

type CreateClaimJobInput = Pick<ClaimJob, "productId" | "planName" | "recipient" | "passengerName"> & {
  payload?: unknown;
  fullSubject?: string;
};

declare global {
  var __destinyClaimJobs: Map<string, ClaimJob> | undefined;
  var __destinyClaimPool: Pool | undefined;
  var __destinyClaimDbReady: Promise<void> | undefined;
}

function now() {
  return new Date().toISOString();
}

function makeJobId() {
  return `DA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function memoryStore() {
  if (!globalThis.__destinyClaimJobs) {
    globalThis.__destinyClaimJobs = new Map<string, ClaimJob>();
  }
  return globalThis.__destinyClaimJobs;
}

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  if (!globalThis.__destinyClaimPool) {
    globalThis.__destinyClaimPool = new Pool({
      connectionString: databaseUrl,
      max: 3,
      ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalThis.__destinyClaimPool;
}

async function ensureDb() {
  const pool = getPool();
  if (!pool) return undefined;

  if (!globalThis.__destinyClaimDbReady) {
    globalThis.__destinyClaimDbReady = pool
      .query(`
        create table if not exists claim_jobs (
          id text primary key,
          status text not null,
          product_id text,
          plan_name text,
          recipient text not null,
          passenger_name text not null,
          message text not null,
          error text,
          payload_json jsonb,
          full_subject text,
          created_at timestamptz not null,
          updated_at timestamptz not null,
          completed_at timestamptz
        )
      `)
      .then(() => undefined);
  }

  await globalThis.__destinyClaimDbReady;
  return pool;
}

function dateToIso(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToJob(row: QueryResultRow): ClaimJob {
  return {
    id: String(row.id),
    status: row.status as ClaimJobStatus,
    productId: typeof row.product_id === "string" ? row.product_id : undefined,
    planName: typeof row.plan_name === "string" ? row.plan_name : undefined,
    recipient: String(row.recipient),
    passengerName: String(row.passenger_name),
    message: String(row.message),
    error: typeof row.error === "string" ? row.error : undefined,
    payload: row.payload_json,
    fullSubject: typeof row.full_subject === "string" ? row.full_subject : undefined,
    createdAt: dateToIso(row.created_at) || now(),
    updatedAt: dateToIso(row.updated_at) || now(),
    completedAt: dateToIso(row.completed_at),
  };
}

export async function createClaimJob(input: CreateClaimJobInput) {
  const createdAt = now();
  const job: ClaimJob = {
    id: makeJobId(),
    status: "queued",
    message: "訂單已建立，等待生成完整報告。",
    createdAt,
    updatedAt: createdAt,
    ...input,
  };

  const pool = await ensureDb();
  if (!pool) {
    memoryStore().set(job.id, job);
    return job;
  }

  await pool.query(
    `
      insert into claim_jobs (
        id, status, product_id, plan_name, recipient, passenger_name, message,
        payload_json, full_subject, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
    `,
    [
      job.id,
      job.status,
      job.productId ?? null,
      job.planName ?? null,
      job.recipient,
      job.passengerName,
      job.message,
      job.payload ? JSON.stringify(job.payload) : null,
      job.fullSubject ?? null,
      job.createdAt,
      job.updatedAt,
    ],
  );

  return job;
}

export async function updateClaimJob(id: string, patch: Partial<Omit<ClaimJob, "id" | "createdAt">>) {
  const updatedAt = now();
  const completedAt = patch.status === "sent" || patch.status === "error" ? updatedAt : patch.completedAt;
  const pool = await ensureDb();

  if (!pool) {
    const jobs = memoryStore();
    const current = jobs.get(id);
    if (!current) return undefined;
    const next: ClaimJob = {
      ...current,
      ...patch,
      updatedAt,
      completedAt,
    };
    jobs.set(id, next);
    return next;
  }

  const sets: string[] = ["updated_at = $1"];
  const values: unknown[] = [updatedAt];

  function setField(column: string, value: unknown) {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }

  if (patch.status !== undefined) setField("status", patch.status);
  if (patch.planName !== undefined) setField("plan_name", patch.planName);
  if (patch.recipient !== undefined) setField("recipient", patch.recipient);
  if (patch.passengerName !== undefined) setField("passenger_name", patch.passengerName);
  if (patch.message !== undefined) setField("message", patch.message);
  if (patch.error !== undefined) setField("error", patch.error);
  if (patch.payload !== undefined) setField("payload_json", patch.payload ? JSON.stringify(patch.payload) : null);
  if (patch.fullSubject !== undefined) setField("full_subject", patch.fullSubject);
  if (completedAt !== undefined) setField("completed_at", completedAt);

  values.push(id);
  const result = await pool.query(
    `
      update claim_jobs
      set ${sets.join(", ")}
      where id = $${values.length}
      returning *
    `,
    values,
  );

  return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
}

export async function getClaimJob(id: string) {
  const pool = await ensureDb();
  if (!pool) return memoryStore().get(id);

  const result = await pool.query("select * from claim_jobs where id = $1 limit 1", [id]);
  return result.rows[0] ? rowToJob(result.rows[0]) : undefined;
}

export async function listClaimJobs(limit = 100) {
  const pool = await ensureDb();
  if (!pool) {
    return [...memoryStore().values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  const result = await pool.query("select * from claim_jobs order by created_at desc limit $1", [limit]);
  return result.rows.map(rowToJob);
}
