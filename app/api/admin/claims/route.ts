import { listClaimJobs } from "../../claim/jobs";

function readCredential(request: Request, name: string) {
  const url = new URL(request.url);
  return request.headers.get(name) || url.searchParams.get(name) || "";
}

function isAuthorized(request: Request) {
  const configuredUser = process.env.ADMIN_USER;
  const configuredPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN;

  if (!configuredUser && !configuredPassword) return true;

  const user = readCredential(request, "x-admin-user");
  const password = readCredential(request, "x-admin-password") || readCredential(request, "x-admin-token");

  if (configuredUser && user !== configuredUser) return false;
  if (configuredPassword && password !== configuredPassword) return false;
  return true;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "後台帳號或密碼不正確。" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 300) : 100;
  const jobs = await listClaimJobs(limit);

  return Response.json({
    jobs,
    database: Boolean(process.env.DATABASE_URL),
    protected: Boolean(process.env.ADMIN_USER || process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN),
    generatedAt: new Date().toISOString(),
  });
}
