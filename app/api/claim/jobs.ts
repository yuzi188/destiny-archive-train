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
  createdAt: string;
  updatedAt: string;
};

declare global {
  var __destinyClaimJobs: Map<string, ClaimJob> | undefined;
}

function store() {
  if (!globalThis.__destinyClaimJobs) {
    globalThis.__destinyClaimJobs = new Map<string, ClaimJob>();
  }
  return globalThis.__destinyClaimJobs;
}

export function createClaimJob(input: Pick<ClaimJob, "productId" | "planName" | "recipient" | "passengerName">) {
  const now = new Date().toISOString();
  const job: ClaimJob = {
    id: `DA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: "queued",
    message: "班次已受理，等待生成完整報告。",
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  store().set(job.id, job);
  return job;
}

export function updateClaimJob(id: string, patch: Partial<Omit<ClaimJob, "id" | "createdAt">>) {
  const jobs = store();
  const current = jobs.get(id);
  if (!current) return undefined;
  const next: ClaimJob = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, next);
  return next;
}

export function getClaimJob(id: string) {
  return store().get(id);
}
