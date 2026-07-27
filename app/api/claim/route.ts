type ProductId = "route" | "transfer" | "archive";

type ClaimRequest = {
  productId?: ProductId;
  recipientEmail?: string;
  passenger?: {
    name?: string;
    birth?: string;
    time?: string;
    unknownTime?: boolean;
    birthplace?: string;
    concern?: string;
    email?: string;
    marketing?: boolean;
  };
  preview?: {
    recordStatus?: string;
    chapters?: Record<string, { title?: string; headline?: string; lines?: string[] }>;
    profile?: {
      title?: string;
      destinyType?: string;
      triangulation?: string[];
      lines?: string[];
    };
    locked?: {
      title?: string;
      chapters?: string[];
      closingTitle?: string;
      closingLine?: string;
      cta?: string;
    };
  };
  chartDisplay?: {
    title?: string;
    summary?: string[];
  };
};

const fallbackRecipient = "q0983120788@gmail.com";

const reportPlans: Record<ProductId, { name: string; paidPrice: string; targetWords: number; maxOutputTokens: number }> = {
  route: {
    name: "第 13 月台路線報告",
    paidPrice: "NT$980",
    targetWords: 3000,
    maxOutputTokens: 7000,
  },
  transfer: {
    name: "轉站套組",
    paidPrice: "NT$1,580",
    targetWords: 7000,
    maxOutputTokens: 13000,
  },
  archive: {
    name: "完整班次表",
    paidPrice: "NT$1,980",
    targetWords: 10000,
    maxOutputTokens: 18000,
  },
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPlan(productId?: ProductId) {
  return reportPlans[productId ?? "archive"] ?? reportPlans.archive;
}

function extractOutputText(result: unknown) {
  const response = result as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typeof response.output_text === "string") return response.output_text.trim();

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n")
      .trim() || ""
  );
}

function renderFallbackReport(payload: ClaimRequest) {
  const passenger = payload.passenger ?? {};
  const plan = getPlan(payload.productId);
  const chart = payload.chartDisplay;
  const preview = payload.preview;
  const profile = preview?.profile;
  const chapters = preview?.chapters ?? {};

  const lines = [
    "第 13 月台 Destiny Archive",
    "",
    `方案：${plan.name}`,
    `收件信箱：${clean(payload.recipientEmail) || fallbackRecipient}`,
    "",
    "乘客資料",
    `姓名：${clean(passenger.name) || "未填"}`,
    `生日：${clean(passenger.birth) || "未填"}`,
    `時間：${passenger.unknownTime ? "不知道時間" : clean(passenger.time) || "未填"}`,
    `出生地：${clean(passenger.birthplace) || "未填"}`,
    `正在逃開的問題：${clean(passenger.concern) || "未填"}`,
    "",
    "三叉分析摘要",
    `八字命格：${profile?.destinyType || "等待完整推算"}`,
    `星盤摘要：${chart?.summary?.join(" / ") || "等待完整推算"}`,
    `用戶問題：${clean(passenger.concern) || "未填"}`,
    "",
    "免費預覽內容",
  ];

  Object.values(chapters).forEach((chapter) => {
    if (!chapter?.title) return;
    lines.push("");
    lines.push(chapter.title);
    if (chapter.headline) lines.push(chapter.headline);
    (chapter.lines ?? []).forEach((line) => lines.push(line));
  });

  lines.push("");
  lines.push("測試說明");
  lines.push("這是一封用來確認寄信流程的測試報告。若你收到此信，代表 Resend 寄信、附件、收件信箱都已成功串接。");
  lines.push("正式付款開通後，這裡會改為依照用戶八字命盤、西洋星盤與問題產生對應字數的小說式完整報告。");

  return lines.join("\n");
}

function buildPrompt(payload: ClaimRequest) {
  const passenger = payload.passenger ?? {};
  const plan = getPlan(payload.productId);
  const passengerSummary = [
    `姓名：${clean(passenger.name) || "未填"}`,
    `生日：${clean(passenger.birth) || "未填"}`,
    `出生時間：${passenger.unknownTime ? "不知道時間" : clean(passenger.time) || "未填"}`,
    `出生地：${clean(passenger.birthplace) || "未填"}`,
    `用戶目前最想逃開的問題：${clean(passenger.concern) || "未填"}`,
  ].join("\n");
  const chartSummary = payload.chartDisplay?.summary?.length
    ? payload.chartDisplay.summary.join(" / ")
    : "星盤摘要暫無前端資料，請依姓名生日時間出生地做可讀性解讀。";

  return [
    "你是第 13 月台 Destiny Archive 的命運檔案撰寫者。",
    "請用小說式但清楚可讀的繁體中文，根據八字命盤、西洋星盤與用戶問題，輸出完整命運報告。",
    `方案：${plan.name}，價格：${plan.paidPrice}，目標字數約 ${plan.targetWords} 字。`,
    "重要規則：下方乘客資料已經是有效輸入。禁止寫「尚未提供資料」「資料不足無法分析」「請補齊資料」這類句子。",
    "若沒有完整天文曆或八字排盤細節，請以已提供的生日、時間、出生地、前端星盤摘要與用戶問題，寫成目前版本的命運報告。",
    "報告結構：開場、乘客資料確認、八字傾向、西洋星盤傾向、用戶問題解析、三叉分析、具體建議、下一站提醒。",
    "文字風格：像一本命運小說，但每一段都要有白話解釋，讓用戶覺得內容有落地、能對照自己。",
    "",
    "乘客資料：",
    passengerSummary,
    "",
    "星盤摘要：",
    chartSummary,
    "",
    "免費預覽資料：",
    JSON.stringify(payload.preview ?? {}),
  ].join("\n");
}

async function generateReport(payload: ClaimRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return renderFallbackReport(payload);

  const plan = getPlan(payload.productId);
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = buildPrompt(payload);

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        max_output_tokens: plan.maxOutputTokens,
      }),
    });

    const result = await upstream.json();
    if (!upstream.ok) throw new Error(result?.error?.message || "OpenAI request failed");

    const text = extractOutputText(result);
    return text || renderFallbackReport(payload);
  } catch (error) {
    console.error("Report generation failed; using fallback report.", error);
    return renderFallbackReport(payload);
  }
}

function makeFilename(payload: ClaimRequest) {
  const passengerName = clean(payload.passenger?.name).replace(/[\\/:*?"<>|\s]+/g, "_") || "passenger";
  const plan = getPlan(payload.productId);
  return `第13月台_${plan.name}_${passengerName}.txt`;
}

async function sendWithResend(to: string, subject: string, report: string, payload: ClaimRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_resend_key" };

  const plan = getPlan(payload.productId);
  const passenger = payload.passenger ?? {};
  const from = process.env.REPORT_FROM_EMAIL || "第 13 月台 <onboarding@resend.dev>";
  const text = [
    "你的第 13 月台命運檔案已建立。",
    "",
    `方案：${plan.name}`,
    `價格：${plan.paidPrice}`,
    "",
    "本次收到的資料：",
    `姓名：${clean(passenger.name) || "未填"}`,
    `生日：${clean(passenger.birth) || "未填"}`,
    `時間：${passenger.unknownTime ? "不知道時間" : clean(passenger.time) || "未填"}`,
    `出生地：${clean(passenger.birthplace) || "未填"}`,
    `問題：${clean(passenger.concern) || "未填"}`,
    "",
    "完整報告如下，附件也保留一份 TXT 檔案。",
    "",
    "────────────────",
    "",
    report,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      attachments: [
        {
          filename: makeFilename(payload),
          content: Buffer.from(report, "utf8").toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "email delivery failed");
  }

  return { sent: true };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ClaimRequest;
    const recipient = clean(payload.recipientEmail) || fallbackRecipient;
    const plan = getPlan(payload.productId);
    const passengerName = clean(payload.passenger?.name) || "乘客";
    const subject = `第 13 月台｜${plan.name}｜${passengerName}`;
    const report = await generateReport(payload);
    const result = await sendWithResend(recipient, subject, report, payload);

    if (!result.sent) {
      return Response.json(
        {
          sent: false,
          message: "報告已產生，但 Resend 尚未設定完成。",
          reason: result.reason,
        },
        { status: 503 },
      );
    }

    return Response.json({
      sent: true,
      message: `完整報告已寄到 ${recipient}。`,
    });
  } catch (error) {
    console.error("Claim email failed.", error);
    return Response.json(
      {
        sent: false,
        message: error instanceof Error ? error.message : "寄送完整報告失敗。",
      },
      { status: 502 },
    );
  }
}
