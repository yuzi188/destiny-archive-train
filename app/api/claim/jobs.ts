import postgres from "postgres";

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
  var __destinyClaimSql: postgres.Sql | undefined;
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

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  if (!globalThis.__destinyClaimSql) {
    globalThis.__destinyClaimSql = postgres(databaseUrl, {
      max: 3,
      prepare: false,
      ssl: databaseUrl.includes("sslmode=require") ? "require" : undefined,
    });
  }

  return globalThis.__destinyClaimSql;
}

async function ensureDb() {
  const sql = getSql();
  if (!sql) return undefined;

  if (!globalThis.__destinyClaimDbReady) {
    globalThis.__destinyClaimDbReady = sql`
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
    `.then(() => undefined);
  }

  await globalThis.__destinyClaimDbReady;
  return sql;
}

function rowToJob(row: Record<string, unknown>): ClaimJob {
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
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : undefined,
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

  const sql = await ensureDb();
  if (!sql) {
    memoryStore().set(job.id, job);
    return job;
  }

  await sql`
    insert into claim_jobs (
      id, status, product_id, plan_name, recipient, passenger_name, message,
      payload_json, full_subject, created_at, updated_at
    )
    values (
      ${job.id}, ${job.status}, ${job.productId ?? null}, ${job.planName ?? null},
      ${job.recipient}, ${job.passengerName}, ${job.message},
      ${job.payload ? sql.json(job.payload) : null}, ${job.fullSubject ?? null},
      ${job.createdAt}, ${job.updatedAt}
    )
  `;

  return job;
}

export async function updateClaimJob(id: string, patch: Partial<Omit<ClaimJob, "id" | "createdAt">>) {
  const updatedAt = now();
  const completedAt = patch.status === "sent" || patch.status === "error" ? updatedAt : patch.completedAt;
  const sql = await ensureDb();

  if (!sql) {
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

  const rows = await sql`
    update claim_jobs
    set
      status = coalesce(${patch.status ?? null}, status),
      plan_name = coalesce(${patch.planName ?? null}, plan_name),
      recipient = coalesce(${patch.recipient ?? null}, recipient),
      passenger_name = coalesce(${patch.passengerName ?? null}, passenger_name),
      message = coalesce(${patch.message ?? null}, message),
      error = ${patch.error ?? null},
      payload_json = coalesce(${patch.payload ? sql.json(patch.payload) : null}, payload_json),
      full_subject = coalesce(${patch.fullSubject ?? null}, full_subject),
      updated_at = ${updatedAt},
      completed_at = coalesce(${completedAt ?? null}, completed_at)
    where id = ${id}
    returning *
  `;

  return rows[0] ? rowToJob(rows[0]) : undefined;
}

export async function getClaimJob(id: string) {
  const sql = await ensureDb();
  if (!sql) return memoryStore().get(id);

  const rows = await sql`select * from claim_jobs where id = ${id} limit 1`;
  return rows[0] ? rowToJob(rows[0]) : undefined;
}

export async function listClaimJobs(limit = 100) {
  const sql = await ensureDb();
  if (!sql) {
    return [...memoryStore().values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  const rows = await sql`
    select *
    from claim_jobs
    order by created_at desc
    limit ${limit}
  `;

  return rows.map(rowToJob);
}
