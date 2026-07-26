import { createHash, timingSafeEqual } from "node:crypto";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: Request) {
  const secretKey = clean(process.env.KHQRPAY_SECRET_KEY);
  const payload = (await request.json().catch(() => ({}))) as {
    req_time?: string;
    transaction_id?: string;
    amount?: string | number;
    status?: string;
    hash?: string;
  };

  const reqTime = clean(payload.req_time);
  const transactionId = clean(payload.transaction_id);
  const amount = clean(String(payload.amount ?? ""));
  const status = clean(payload.status).toUpperCase();
  const hash = clean(payload.hash);

  if (!secretKey || !reqTime || !transactionId || !amount || !status || !hash) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const expected = createHash("sha256").update(secretKey + reqTime + transactionId + amount + status).digest("hex");
  if (!safeEqual(expected, hash)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  console.info("KHQRPay payment callback verified.", { transactionId, amount, status });
  return Response.json({ ok: true });
}
