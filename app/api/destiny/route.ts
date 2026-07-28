import { calculateDestinyChart } from "./calculations.js";

type DestinyRequest = {
  name?: string;
  birth?: string;
  time?: string;
  unknownTime?: boolean;
  birthplace?: string;
  concern?: string;
};

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recordStatus", "chapters", "profile", "locked"],
  properties: {
    recordStatus: { type: "string", maxLength: 12 },
    chapters: {
      type: "object",
      additionalProperties: false,
      required: ["seen", "inner", "repeat", "blindSpot", "future"],
      properties: {
        seen: chapterSchema(true),
        inner: chapterSchema(false),
        repeat: chapterSchema(false),
        blindSpot: chapterSchema(true),
        future: chapterSchema(true),
      },
    },
    profile: {
      type: "object",
      additionalProperties: false,
      required: ["title", "destinyType", "triangulation", "lines"],
      properties: {
        title: { type: "string", maxLength: 14 },
        destinyType: { type: "string", maxLength: 5 },
        triangulation: {
          type: "array",
          minItems: 3,
          maxItems: 3,
        items: { type: "string", maxLength: 24 },
        },
        lines: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: { type: "string", maxLength: 22 },
        },
      },
    },
    locked: {
      type: "object",
      additionalProperties: false,
      required: ["title", "chapters", "closingTitle", "closingLine", "cta"],
      properties: {
        title: { type: "string", maxLength: 12 },
        chapters: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string", maxLength: 24 },
        },
        closingTitle: { type: "string", maxLength: 14 },
        closingLine: { type: "string", maxLength: 14 },
        cta: { type: "string", maxLength: 12 },
      },
    },
  },
};

function chapterSchema(hasHeadline: boolean) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "headline", "lines"],
    properties: {
      title: { type: "string", maxLength: 14 },
      headline: { type: "string", maxLength: 20 },
      lines: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", maxLength: 22 },
      },
    },
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function extractOutputText(payload: unknown) {
  const response = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ parsed?: unknown; text?: unknown; type?: string }> }>;
  };

  if (typeof response.output_text === "string") return response.output_text;

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => {
      if (content.parsed && typeof content.parsed === "object") return JSON.stringify(content.parsed);
      if (typeof content.text === "string") return content.text;
      if (content.text && typeof content.text === "object") return JSON.stringify(content.text);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractChatText(payload: unknown) {
  const response = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> } }>;
  };
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  return content
    ?.map((item) => item.text)
    .filter(Boolean)
    .join("\n");
}

function parseModelJson(outputText: string) {
  const cleaned = outputText
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("model returned invalid JSON");
  }
}

function sanitizePassengerFacingText(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/三叉分析|路線交會|路線對軌/g, "你反覆卡住的地方"],
    [/八字命格|八字|命盤|出生軌跡|第一張票底/g, "你的習慣"],
    [/西洋星盤|出生星盤|星盤|星座|夜空座標/g, "你藏起來的反應"],
    [/五行/g, "你的情緒溫度"],
    [/流年|大運/g, "下一次選擇"],
    [/十神/g, "你和別人的距離"],
    [/命理|專業資料/g, "這份記錄"],
    [/太陽/g, "你表現出來的樣子"],
    [/月亮/g, "你心裡真正的反應"],
    [/上升/g, "別人第一眼看到的你"],
  ];

  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function sanitizePassengerFacingJson<T>(value: T): T {
  if (typeof value === "string") return sanitizePassengerFacingText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizePassengerFacingJson(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, sanitizePassengerFacingJson(child)]),
    ) as T;
  }
  return value;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.6";

  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  const payload = (await request.json()) as DestinyRequest;
  const passenger = {
    name: clean(payload.name),
    birth: clean(payload.birth),
    time: payload.unknownTime ? "時間未知" : clean(payload.time),
    birthplace: clean(payload.birthplace),
    concern: clean(payload.concern),
  };

  if (!passenger.name || !passenger.birth || !passenger.birthplace || !passenger.concern) {
    return Response.json({ error: "missing required passenger fields" }, { status: 400 });
  }

  let calculatedChart;
  try {
    calculatedChart = calculateDestinyChart({
      birth: passenger.birth,
      time: payload.time,
      unknownTime: payload.unknownTime,
      birthplace: passenger.birthplace,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "birth chart calculation failed";
    return Response.json({ error: message }, { status: 400 });
  }

  const prompt = [
    "你是《第 13 月台》互動命運列車的書記官。",
    "請根據後端已計算完成的專業資料，產生前台免費預覽用的 Destiny Archive 書頁文案。",
    "你不能重新推算盤面，也不能編造盤面；只能解讀 calculatedChart 裡的資料。",
    "乘客資料裡的 concern 是使用者親自選定的問題分類，必須直接納入解讀；不可寫問題未明、未提供、等待名字。",
    "免費預覽的重點不是專業說明，而是讓使用者有「你怎麼知道」的被看穿感。",
    "不要解釋資料來源，不要說你根據什麼分析，不要使用任何專業術語或包裝術語。",
    "所有輸出欄位禁止出現：八字、星盤、星座、命盤、五行、流年、大運、十神、命理、三叉分析、夜空座標、第一張票底、路線交會、路線對軌、出生軌跡、專業資料。",
    "請把所有判讀翻成生活細節，例如：你常先說沒事、你怕麻煩別人、你會先觀察對方值不值得、你不是不想改，是怕改了也沒人接住。",
    "第四頁 profile 不要輸出能力條。destinyType 只能從這五個生活型稱呼選：先撐型、守夜型、收尾型、觀察型、重啟型。",
    "profile.triangulation 不要寫來源，只寫三句具體生活行為；profile.lines 寫兩句簡短結論。",
    "風格：繁體中文、神祕、高級、像小說揭露，不恐怖，不要提 AI、GPT。",
    "解析要具體：每頁至少有一句要指到使用者問題對應的生活行為，例如在關係裡先沉默、工作上先承擔、壓力來時先找退路。",
    "不要只寫抽象安慰，例如『你很敏感』『你很努力』；要寫成『你在壓力來時會先接住別人的期待』這種可感覺命中的句子。",
    "每一章 lines 格式固定：前 2 句是像角色看穿內心的句子，最後 1 句是生活化補刀，但不要加「白話：」這種標籤。",
    "最後一句要更像心理命中，例如『你常先扛再說累』『你不是不需要人，只是太怕開口後沒人接住』，不可重複前一句。",
    "限制：這是娛樂/自我反思內容，不要做醫療、法律、投資、保證命運的斷言。",
    "字數規則非常重要：title 最多 14 字，headline 最多 20 字，一般 lines 固定 3 句，每句最多 22 個中文字。",
    "有 headline 的章節也必須輸出 3 句 lines，其中第 3 句是生活化白話補充，不要加標籤。",
    "第四章 triangulation 固定 3 句，每句最多 24 字；第四章 lines 固定 2 句，每句最多 22 字，其中至少 1 句是生活化白話補充，但不要加「白話：」標籤。",
    "不要長段落，不要逗號堆疊，不要補充說明，不要使用 emoji，不要輸出 Markdown。",
    `乘客資料：${JSON.stringify(passenger)}`,
    `calculatedChart：${JSON.stringify(calculatedChart)}`,
  ].join("\n");

  const responseFormat = {
    type: "json_schema",
    name: "destiny_archive_preview",
    strict: true,
    schema: jsonSchema,
  };

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      max_output_tokens: 3200,
      text: {
        format: responseFormat,
      },
    }),
  });

  const result = await upstream.json();

  if (!upstream.ok) {
    const message = result?.error?.message || "OpenAI request failed";
    return Response.json({ error: message }, { status: 502 });
  }

  let outputText = extractOutputText(result);

  if (!outputText) {
    const chatFallback = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 3200,
        response_format: {
          type: "json_schema",
          json_schema: responseFormat,
        },
      }),
    });

    const chatResult = await chatFallback.json();
    if (!chatFallback.ok) {
      const message = chatResult?.error?.message || "OpenAI request failed";
      return Response.json({ error: message }, { status: 502 });
    }
    outputText = extractChatText(chatResult);
  }

  if (!outputText) {
    return Response.json({ error: "empty model response" }, { status: 502 });
  }

  try {
    return Response.json({
      preview: sanitizePassengerFacingJson(parseModelJson(outputText)),
      chartDisplay: sanitizePassengerFacingJson(calculatedChart.astrology.display),
    });
  } catch {
    return Response.json({ error: "model returned invalid JSON" }, { status: 502 });
  }
}

