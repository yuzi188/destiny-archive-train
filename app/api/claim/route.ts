type ClaimRequest = {
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

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function renderReport(payload: ClaimRequest) {
  const passenger = payload.passenger ?? {};
  const preview = payload.preview ?? {};
  const profile = preview.profile ?? {};
  const locked = preview.locked ?? {};
  const chapters = preview.chapters ?? {};
  const chart = payload.chartDisplay ?? {};
  const lines: string[] = [];

  lines.push("第 13 月台｜完整命運檔案");
  lines.push("");
  lines.push(`乘客：${clean(passenger.name) || "未填"}`);
  lines.push(`生日：${clean(passenger.birth) || "未填"}`);
  lines.push(`時間：${passenger.unknownTime ? "時間未知" : clean(passenger.time) || "時間未知"}`);
  lines.push(`出生地：${clean(passenger.birthplace) || "未填"}`);
  lines.push(`目前問題：${clean(passenger.concern) || "未填"}`);
  lines.push("");
  lines.push(`星盤摘要：${(chart.summary ?? []).join("｜") || "已建立"}`);
  lines.push("");

  Object.values(chapters).forEach((chapter) => {
    if (!chapter?.title) return;
    lines.push(chapter.title);
    if (chapter.headline) lines.push(chapter.headline);
    (chapter.lines ?? []).forEach((line) => lines.push(line));
    lines.push("");
  });

  lines.push(profile.title || "第四章｜命格三叉分析");
  lines.push(`命格：${profile.destinyType || "已建立"}`);
  (profile.triangulation ?? []).forEach((line) => lines.push(line));
  (profile.lines ?? []).forEach((line) => lines.push(line));
  lines.push("");

  lines.push(locked.title || "後續章節");
  (locked.chapters ?? []).forEach((line) => lines.push(`- ${line}`));
  if (locked.closingTitle) lines.push(locked.closingTitle);
  if (locked.closingLine) lines.push(locked.closingLine);

  return lines.join("\n");
}

async function sendWithResend(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_resend_key" };

  const from = process.env.REPORT_FROM_EMAIL || "第 13 月台 <onboarding@resend.dev>";
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
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "email delivery failed");
  }

  return { sent: true };
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ClaimRequest;
  const recipient = clean(payload.recipientEmail) || fallbackRecipient;
  const report = renderReport(payload);
  const subject = `第 13 月台完整命運檔案｜${clean(payload.passenger?.name) || "乘客"}`;

  try {
    const result = await sendWithResend(recipient, subject, report);
    if (result.sent) {
      return Response.json({
        sent: true,
        message: `完整報告已寄到 ${recipient}。`,
      });
    }

    console.info("Full report generated but email service is not configured.", {
      recipient,
      subject,
      report,
    });

    return Response.json({
      sent: false,
      message: "完整報告已建立。寄送服務尚未開通，設定完成後就能直接寄出。",
    });
  } catch {
    return Response.json(
      {
        sent: false,
        message: "完整報告已建立，但寄送暫時失敗。請稍後再試。",
      },
      { status: 502 },
    );
  }
}
