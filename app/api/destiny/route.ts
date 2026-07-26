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
    recordStatus: { type: "string" },
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
      required: ["title", "core", "bars"],
      properties: {
        title: { type: "string" },
        core: { type: "string" },
        bars: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "value"],
            properties: {
              label: { type: "string" },
              value: { type: "number", minimum: 12, maximum: 92 },
            },
          },
        },
      },
    },
    locked: {
      type: "object",
      additionalProperties: false,
      required: ["title", "chapters", "closingTitle", "closingLine", "cta"],
      properties: {
        title: { type: "string" },
        chapters: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" },
        },
        closingTitle: { type: "string" },
        closingLine: { type: "string" },
        cta: { type: "string" },
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
      title: { type: "string" },
      headline: { type: "string" },
      lines: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string" },
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

  const prompt = [
    "你是《第 13 月台》互動命運列車的書記官。",
    "請根據乘客資料，產生免費預覽用的 Destiny Archive 書頁文案。",
    "風格：繁體中文、神祕、高級、像小說揭露，不恐怖，不要提 AI、GPT、八字排盤細節。",
    "限制：這是娛樂/自我反思內容，不要做醫療、法律、投資、保證命運的斷言。",
    "每句短一點，適合手機漫畫書頁；不要使用 emoji；不要輸出 Markdown。",
    `乘客資料：${JSON.stringify(passenger)}`,
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
