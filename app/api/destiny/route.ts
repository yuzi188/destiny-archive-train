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
    [/三叉分析/g, "三條線交會"],
    [/八字命格/g, "路線性質"],
    [/西洋星盤/g, "夜空座標"],
    [/出生星盤/g, "夜空座標"],
    [/八字/g, "第一張票底"],
    [/星盤/g, "夜空座標"],
    [/星座/g, "天空記號"],
    [/命盤/g, "乘客檔案"],
    [/五行/g, "能量氣候"],
    [/流年/g, "下一站時間表"],
    [/大運/g, "長線班次"],
    [/十神/g, "關係座位"],
    [/命理/g, "路線解析"],
    [/太陽/g, "第一記號"],
    [/月亮/g, "內在記號"],
    [/上升/g, "入口記號"],
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
    "內部可以融合出生資料、夜空座標、第一張票底與使用者問題，但輸出給前台時必須全部轉成第 13 月台世界觀語言。",
    "禁用詞非常重要：所有輸出欄位不得出現「八字、星盤、星座、命盤、五行、流年、大運、十神、命理、三叉分析」這些字。",
    "替換規則：八字/命盤改成第一張票底、出生軌跡、乘客檔案；星盤/星座改成夜空座標、天空記號、星軌；五行改成能量氣候或性格溫度；流年/大運改成下一站時間表或長線班次；三叉分析改成三條線交會或路線對軌。",
    "第四頁 profile 不要輸出能力條。請用「三條線交會」文字呈現：出生軌跡、夜空座標、使用者問題三者交叉，最後歸類為 5 種路線性質之一。",
    "5 種路線性質只能從這五個選：開路者、守夜者、承擔者、轉譯者、重啟者。destinyType 必須是其中之一，triangulation 三句分別對應第一張票底、夜空座標、問題入口，lines 說明為什麼命中。",
    "風格：繁體中文、神祕、高級、像小說揭露，不恐怖，不要提 AI、GPT。",
    "解析要具體：每頁至少有一句要指到實際資料或使用者問題，但必須用列車世界觀說法呈現，例如第一張票底、夜空座標、入口記號、反覆停靠的月台、或 concern 對應的行為模式。",
    "不要只寫抽象安慰，例如『你很敏感』『你很努力』；要寫成『你在壓力來時會先接住別人的期待』這種可感覺命中的句子。",
    "每一章 lines 格式固定：前 2 句是列車世界觀判讀，最後 1 句是生活化白話補充，但不要加「白話：」這種標籤。",
    "白話註解要把判讀翻成生活行為，例如『你常先扛再說累』，不可重複前一句。",
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

