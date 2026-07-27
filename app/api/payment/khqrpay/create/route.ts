import { createHash } from "node:crypto";

type PaymentRequest = {
  productId?: "route" | "transfer" | "archive";
};

const pricesUsd = {
  route: "1.00",
  transfer: "49.00",
  archive: "59.00",
} as const;

const productNames = {
  route: "Route Preview",
  transfer: "Transfer Reading",
  archive: "Full Destiny Archive",
} as const;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPublicOrigin(request: Request) {
  const configuredOrigin = clean(process.env.PUBLIC_SITE_URL);
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, "");

  const url = new URL(request.url);
  const forwardedHost = clean(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || url.host;
  const forwardedProto = clean(request.headers.get("x-forwarded-proto"));
  const proto = host.endsWith(".up.railway.app") ? "https" : forwardedProto || url.protocol.replace(":", "");

  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const profileId = clean(process.env.KHQRPAY_PROFILE_ID);
  const secretKey = clean(process.env.KHQRPAY_SECRET_KEY);

  if (!profileId || !secretKey) {
    return Response.json({ error: "KHQRPay is not configured." }, { status: 503 });
  }

  const payload = (await request.json().catch(() => ({}))) as PaymentRequest;
  const productId = payload.productId && payload.productId in pricesUsd ? payload.productId : "route";
  const amount = pricesUsd[productId];
  const transactionId = `ABA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const origin = getPublicOrigin(request);
  const successUrl = `${origin}/?khqr_tx=${encodeURIComponent(transactionId)}`;
  const remark = productNames[productId];
  const hash = createHash("sha1").update(secretKey + transactionId + amount + successUrl + remark).digest("hex");
  const checkoutUrl = new URL(`https://khqr.cc/api/payment/request/${profileId}`);

  checkoutUrl.searchParams.set("transaction_id", transactionId);
  checkoutUrl.searchParams.set("amount", amount);
  checkoutUrl.searchParams.set("success_url", successUrl);
  checkoutUrl.searchParams.set("remark", remark);
  checkoutUrl.searchParams.set("hash", hash);

  return Response.json({
    checkoutUrl: checkoutUrl.toString(),
    transactionId,
    amount,
  });
}
