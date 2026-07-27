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

  return [
    "你是第 13 月台 Destiny Archive 的命運檔案撰寫者。",
    "請用小說式但清楚可讀的繁體中文，根據八字命盤、西洋星盤與用戶問題，輸出完整命運報告。",
    `方案：${plan.name}，價格：${plan.paidPrice}，目標字數約 ${plan.targetWords} 字。`,
    "報告結構：",
    "1. 開場：用列車與命運檔案的敘事方式引入。",
    "2. 八字分析：人格底色、壓力模式、慣性選擇。",
    "3. 星盤分析：太陽、月亮、上升與關係/職涯傾向。",
    "4. 用戶問題：直接回應他最近最想逃開的問題。",
    "5. 三叉結論：八字、星盤、問題如何指向同一個命題。",
    "6. 具體建議：可執行的下一站行動。",
    "",
    "乘客資料：",
    JSON.stringify(passenger),
    "",
    "免費預覽資料：",
    JSON.stringify(payload.preview ?? {}),
    "",
    "星盤顯示資料：",
    JSON.stringify(payload.chartDisplay ?? {}),
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
  const from = process.env.REPORT_FROM_EMAIL || "第 13 月台 <onboarding@resend.dev>";
  const text = [
    "你的第 13 月台命運檔案已建立。",
    "",
    `方案：${plan.name}`,
    `價格：${plan.paidPrice}`,
    "",
    "完整內容已附在這封信的 TXT 檔案中。",
    "目前這封信用於測試寄送流程；若你能收到，代表信箱串接成功。",
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
