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
          items: { type: "string", maxLength: 22 },
        },
        lines: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: { type: "string", maxLength: 14 },
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
    required: hasHeadline ? ["title", "headline", "lines"] : ["title", "lines"],
    properties: {
      title: { type: "string", maxLength: 14 },
      headline: { type: "string", maxLength: 18 },
      lines: {
        type: "array",
        minItems: 2,
        maxItems: hasHeadline ? 2 : 3,
        items: { type: "string", maxLength: 14 },
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
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typeof response.output_text === "string") return response.output_text;

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";

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
    "請根據後端已計算完成的八字與西洋星盤資料，產生免費預覽用的 Destiny Archive 書頁文案。",
    "你不能重新推算盤面，也不能編造盤面；只能解讀 calculatedChart 裡的資料。",
    "必須把八字與星盤融合：四柱/日主/五行/十神/命宮，加上太陽/月亮/內行星落座。時間明確時可使用上升星座；若時間未知，不要提上升。",
    "第四章 profile 不要輸出能力條。請用「三叉分析」文字呈現：八字命格、星盤人格、使用者問題三者交叉，最後歸類為 5 種命格之一。",
    "5 種命格只能從這五個選：開路者、守夜者、承擔者、轉譯者、重啟者。destinyType 必須是其中之一，triangulation 三句分別對應八字、星盤、問題，lines 說明為什麼命中。",
    "風格：繁體中文、神祕、高級、像小說揭露，不恐怖，不要提 AI、GPT。",
    "限制：這是娛樂/自我反思內容，不要做醫療、法律、投資、保證命運的斷言。",
    "字數規則非常重要：title 最多 14 字，headline 最多 18 字，一般 lines 每句最多 14 個中文字。",
    "有 headline 的章節只能輸出 2 句 lines；沒有 headline 的章節最多 3 句 lines。",
    "第四章 triangulation 固定 3 句，每句最多 22 字；第四章 lines 固定 2 句，每句最多 14 字。",
    "不要長段落，不要逗號堆疊，不要補充說明，不要使用 emoji，不要輸出 Markdown。",
    `乘客資料：${JSON.stringify(passenger)}`,
    `calculatedChart：${JSON.stringify(calculatedChart)}`,
  ].join("\n");

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
      max_output_tokens: 1600,
      text: {
        format: {
          type: "json_schema",
          name: "destiny_archive_preview",
          strict: true,
          schema: jsonSchema,
        },
      },
    }),
  });

  const result = await upstream.json();

  if (!upstream.ok) {
    const message = result?.error?.message || "OpenAI request failed";
    return Response.json({ error: message }, { status: 502 });
  }

  const outputText = extractOutputText(result);
  if (!outputText) {
    return Response.json({ error: "empty model response" }, { status: 502 });
  }

  try {
    return Response.json({ preview: JSON.parse(outputText) });
  } catch {
    return Response.json({ error: "model returned invalid JSON" }, { status: 502 });
  }
}
