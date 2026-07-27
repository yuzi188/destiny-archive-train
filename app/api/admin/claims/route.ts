import { listClaimJobs } from "../../claim/jobs";

function readAdminToken(request: Request) {
  const url = new URL(request.url);
  return request.headers.get("x-admin-token") || url.searchParams.get("token") || "";
}

function isAuthorized(request: Request) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) return true;
  return readAdminToken(request) === configuredToken;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { error: "後台密碼不正確。" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 300) : 100;
  const jobs = await listClaimJobs(limit);

  return Response.json({
    jobs,
    database: Boolean(process.env.DATABASE_URL),
    protected: Boolean(process.env.ADMIN_TOKEN),
    generatedAt: new Date().toISOString(),
  });
}
