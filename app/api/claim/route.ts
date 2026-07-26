type ClaimRequest = {
  productId?: "route" | "transfer" | "archive";
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

const reportPlans = {
  route: {
    name: "第 13 月台路線報告",
    paidPrice: "NT$980",
    targetWords: 3000,
    minimumWords: 2600,
    maxOutputTokens: 7000,
    depth: "精準版：聚焦核心誤點模式、未來 90 天提醒、三個行動處方。",
  },
  transfer: {
    name: "轉站套組",
    paidPrice: "NT$1,580",
    targetWords: 7000,
    minimumWords: 6200,
    maxOutputTokens: 13000,
    depth: "進階版：包含路線報告、職涯合作班次、關係避雷時刻與轉站建議。",
  },
  archive: {
    name: "完整班次表",
    paidPrice: "NT$1,980",
    targetWords: 10000,
    minimumWords: 8500,
    maxOutputTokens: 18000,
    depth: "完整版：完整人生路線、金錢與關係分岔、30 天轉站清單與後續章節。",
  },
} as const;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractOutputText(result: unknown) {
  const response = result as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
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

function extractChatText(result: unknown) {
  const response = result as { choices?: Array<{ message?: { content?: string } }> };
  return response.choices?.[0]?.message?.content?.trim() || "";
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

async function generateLongReport(payload: ClaimRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.6";
  if (!apiKey) return renderReport(payload);

  const passenger = payload.passenger ?? {};
  const plan = reportPlans[payload.productId ?? "archive"] ?? reportPlans.archive;
  const prompt = [
    "你是《第 13 月台｜Destiny Archive》的完整報告書記官。",
    "請根據使用者資料、免費預覽內容、星盤摘要，生成一份繁體中文完整命運報告。",
    `使用者購買方案：${plan.name}，價格 ${plan.paidPrice}。`,
    `方案深度：${plan.depth}`,
    `報告目標長度：約 ${plan.targetWords} 個繁體中文字。不可只輸出摘要，不可少於 ${plan.minimumWords} 字。`,
    "這是娛樂與自我反思用途，不可做醫療、法律、投資、保證命運的斷言。",
    "寫作風格：高級、神祕、小說感，但要白話好懂。每個命理判斷後都要加生活化解釋。",
    "必須保留免費預覽裡原本的判讀方向，再延伸成完整分析。",
    "報告必須包含以下章節：",
    "1. 封面資料與閱讀說明",
    "2. 八字核心：日主、五行傾向、十神傾向、性格形成",
    "3. 星盤核心：太陽、月亮、上升與內在矛盾",
    "4. 三叉命格：八字、星盤、使用者問題三者交會後的 5 種命格分類",
    "5. 我看到的你：外在行為、壓力反應、做事模式",
    "6. 真正的你：情緒需求、關係中的防衛、沉默原因",
    "7. 重複的人生路線：為什麼同一種問題反覆出現",
    "8. 愛情完整章：吸引對象、相處模式、容易卡住的點、建議",
    "9. 財富完整章：賺錢模式、風險、適合累積的方式、建議",
    "10. 職涯完整章：適合的位置、合作方式、卡關原因、下一步",
    "11. 最大盲點：最容易誤判自己的地方",
    "12. 未來 12 個月路線：分成近期、中期、後期三段",
    "13. 改變建議：三個可執行行動",
    "14. 結語：列車長凜的收束台詞",
    "格式規則：",
    "每章都要有標題。段落要短，適合手機閱讀。不要 Markdown 表格。不要 emoji。",
    "980 方案可以濃縮章節但要完整；1580 方案要比 980 更具體；1980 方案要完整展開所有章節。",
    "重點章節愛情、財富、職涯要依方案深度加長：980 簡明，1580 詳細，1980 完整。",
    "若資料不足，請明確說『此處以已提供資料推估』，但仍要完成報告。",
    `使用者資料：${JSON.stringify(passenger)}`,
    `免費預覽：${JSON.stringify(payload.preview ?? {})}`,
    `星盤顯示資料：${JSON.stringify(payload.chartDisplay ?? {})}`,
  ].join("\n");

  const responseBody = {
    model,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    max_output_tokens: plan.maxOutputTokens,
  };

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(responseBody),
  });

  const result = await upstream.json();
  if (upstream.ok) {
    const text = extractOutputText(result);
    if (text) return text;
  }

  const chatFallback = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: plan.maxOutputTokens,
    }),
  });

  const chatResult = await chatFallback.json();
  if (!chatFallback.ok) {
    throw new Error(chatResult?.error?.message || result?.error?.message || "full report generation failed");
  }

  const text = extractChatText(chatResult);
  if (!text) throw new Error("empty full report response");
  return text;
}

function makeFilename(payload: ClaimRequest) {
  const passengerName = clean(payload.passenger?.name).replace(/[\\/:*?"<>|\s]+/g, "_") || "乘客";
  const plan = reportPlans[payload.productId ?? "archive"] ?? reportPlans.archive;
  return `第13月台_${plan.name}_${passengerName}.txt`;
}

async function sendWithResend(to: string, subject: string, report: string, payload: ClaimRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_resend_key" };

  const from = process.env.REPORT_FROM_EMAIL || "第 13 月台 <onboarding@resend.dev>";
  const plan = reportPlans[payload.productId ?? "archive"] ?? reportPlans.archive;
  const text = [
    "你的第 13 月台完整命運檔案已完成。",
    "",
    `方案：${plan.name}`,
    `價格：${plan.paidPrice}`,
    `目標字數：約 ${plan.targetWords} 字`,
    "",
    "完整報告已附在這封信的 TXT 檔案中。",
    "這份內容僅作娛樂與自我探索參考，不構成醫療、法律、投資或人生保證建議。",
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
  const payload = (await request.json()) as ClaimRequest;
  const recipient = clean(payload.recipientEmail) || fallbackRecipient;
  const plan = reportPlans[payload.productId ?? "archive"] ?? reportPlans.archive;
  const subject = `第 13 月台｜${plan.name}｜${clean(payload.passenger?.name) || "乘客"}`;

  try {
    const report = await generateLongReport(payload);
    const result = await sendWithResend(recipient, subject, report, payload);
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
