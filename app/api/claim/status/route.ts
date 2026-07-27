import { getClaimJob } from "../jobs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("jobId") || "";
  const job = await getClaimJob(id);

  if (!job) {
    return Response.json(
      {
        found: false,
        message: "找不到這筆報告任務，可能伺服器已重新啟動或任務編號不正確。",
      },
      { status: 404 },
    );
  }

  return Response.json({
    found: true,
    job,
  });
}
