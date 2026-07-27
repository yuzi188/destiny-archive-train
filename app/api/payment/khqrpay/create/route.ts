type PaymentRequest = {
  productId?: "route" | "transfer" | "archive";
};

const pricesUsd = {
  route: "1.00",
  transfer: "49.00",
  archive: "59.00",
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
  const checkoutUrl = new URL(`https://checkout.khqr.cc/payment/smmv2/${profileId}`);
  checkoutUrl.searchParams.set("amount", amount);
  checkoutUrl.searchParams.set("min", "1");
  checkoutUrl.searchParams.set("max", "1000");
  checkoutUrl.searchParams.set("transaction_id", transactionId);
  checkoutUrl.searchParams.set("success_url", successUrl);

  return Response.json({
    checkoutUrl: checkoutUrl.toString(),
    transactionId,
    amount,
  });
}
