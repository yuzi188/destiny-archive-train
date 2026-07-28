import { createClaimJob, updateClaimJob } from "./jobs";

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

type ReportSection = {
  title: string;
  words: number;
  focus: string;
};

const routeStoryLine = [
  "故事線定位：一張單程票被打開，使用者先看見自己目前最明顯、最容易被命運辨識的那一面。",
  "閱讀節奏：不要展開過多支線，先把一個核心問題講清楚，讓使用者覺得被命中。",
  "分析順序：外在呈現 → 反覆停靠的卡點 → 30 天內可以先做的第一個調整。",
  "弱點規則：必須指出一個最明顯的性格弱點或行為缺點，並說明它如何讓目前問題重複發生。",
  "輸出效果：像列車長先給一張路線提示，不揭露全部班次，但要讓使用者拿到可執行方向。",
];

const transferStoryLine = [
  "故事線定位：使用者來到轉站口，手上不是終點票，而是一份關於職涯、合作與關係避雷的轉乘指引。",
  "閱讀節奏：先指出慣性，再指出合作與關係中的觸發點，最後把三條線交會收束成下一步選擇。",
  "分析順序：目前站點 → 舊慣性 → 合作暗號 → 關係避雷 → 路線卡點 → 90 天轉站行動。",
  "弱點規則：必須分別指出職涯合作弱點、關係互動缺點、情緒盲點，並說明哪種人或情境會放大這些問題。",
  "輸出效果：比單程票更具策略感，讓使用者知道該換哪條線、避開哪種人、先處理哪種選擇。",
];

const archiveStoryLine = [
  "故事線定位：完整班次表被解封，使用者看到的不只是下一站，而是人生路線、金錢、關係、職涯與未來轉折。",
  "閱讀節奏：像一本完整班次小說，先建立檔案，再逐章揭露內在性格、反覆命題、三條線交會與未來清單。",
  "分析順序：乘客檔案 → 內在行李 → 性格倒影 → 夜空訊號 → 路線交會 → 關係與職涯 → 未來風險 → 改變路線 → 行動清單。",
  "弱點規則：必須完整揭露性格弱點、感情盲點、金錢缺口、職涯瓶頸、人際缺點，以及如果不改會反覆失去什麼。",
  "輸出效果：要有完整收藏感，像使用者真的收到一份可以反覆閱讀的命運檔案。",
];

function withStoryLine(prompt: string, storyLine: string[]) {
  return [
    "請先遵守以下固定故事線，再根據本章要求生成內容。",
    ...storyLine,
    "",
    "重要規則：故事線只用來控制結構與節奏，不要逐字照抄。",
    "重要規則：每一章都要接續同一個列車班次檔案世界觀，不要變成普通解析文章。",
    "重要規則：弱點、缺點、盲點要具體、可對應生活情境；語氣要像冷靜提醒，不要羞辱、恐嚇或責罵使用者。",
    "重要規則：指出弱點後一定要補上白話解釋與改善方向，避免只有負面判斷。",
    "重要規則：輸出要直接進入正文，不要解釋你正在套用模板。",
    "",
    prompt,
  ].join("\n");
}

const routeSections: ReportSection[] = [
  {
    title: "第一章｜被看見的那一面",
    words: 900,
    focus: "用第一張票底與夜空座標切入，說明使用者外在呈現、做事方式、被別人看見的第一印象，以及這些特質如何影響當前問題。加入一個最容易被忽略的表面弱點。",
  },
  {
    title: "第二章｜反覆停靠的那一站",
    words: 1000,
    focus: "解析使用者反覆遇到的核心課題，包含壓力、關係、職涯或自我懷疑的循環，並用白話說明為什麼會一直重複。明確指出造成循環的缺點或逃避習慣。",
  },
  {
    title: "第三章｜下一站的處方箋",
    words: 1100,
    focus: "給出未來 30 天可執行的方向，包含應該先處理什麼、暫時不要做什麼、怎麼把問題拆小，以及一份行動清單。把弱點轉成一個可練習的調整方法。",
  },
];

const transferSections: ReportSection[] = [
  {
    title: "第一章｜你正站在轉站口",
    words: 900,
    focus: "以乘客資料、出生時間地點與當前問題建立故事入口，說明這份報告不是泛用描述，而是從出生軌跡、夜空座標與用戶問題交會後展開。",
  },
  {
    title: "第二章｜你帶上車的慣性",
    words: 1100,
    focus: "解析使用者在人生中反覆出現的責任模式、壓力來源、做決定時的慣性，以及為什麼常常看似有方向卻仍覺得被困住。",
  },
  {
    title: "第三章｜合作裡的暗號",
    words: 1200,
    focus: "聚焦職涯與合作班次，說明適合的工作節奏、合作對象、容易踩雷的溝通方式、什麼人會消耗他，什麼人會推動他。加入合作中的弱點、溝通缺點與容易被利用的位置。",
  },
  {
    title: "第四章｜關係裡的避雷時刻",
    words: 1100,
    focus: "解析感情、人際、家庭或親密關係中的觸發點、界線問題、靠近與後退的時機，並給出可執行提醒。明確指出感情盲點、情緒弱點與容易重複受傷的模式。",
  },
  {
    title: "第五章｜三條線交會的真正卡點",
    words: 1400,
    focus: "把第一張票底、夜空座標、用戶最近想逃開的問題整合成三條線交會，指出目前真正卡住的位置，以及它不是單一事件，而是長期慣性的結果。收束出一個最核心的缺點與一個最需要修正的盲點。",
  },
  {
    title: "第六章｜下一班車的選擇清單",
    words: 1300,
    focus: "給出未來 30 到 90 天的具體行動建議，包含職涯、合作、關係、個人界線與決策順序，讓報告具有可落地的方向感。",
  },
];

const archiveSections: ReportSection[] = [
  {
    title: "第一章｜乘客檔案與第一張票",
    words: 900,
    focus: "確認姓名、生日、時間、出生地與用戶問題，小說式開場，讓使用者知道這份報告是針對本人。",
  },
  {
    title: "第二章｜你一直帶著上車的行李",
    words: 1200,
    focus: "用生日時間出生地做出生軌跡解讀，講人格底色、壓力反應、行動慣性，附白話例子。",
  },
  {
    title: "第三章｜車窗倒映出的真正性格",
    words: 1100,
    focus: "用能量氣候語言解釋他的穩定、固執、承擔、焦慮、反覆思考，避免硬列資料，重點是可讀的解釋。",
  },
  {
    title: "第四章｜夜空寫下的三個訊號",
    words: 1300,
    focus: "以第一記號、內在記號、入口記號分析外在形象、內在安全感、職涯節奏與關係需求。",
  },
  {
    title: "第五章｜三條線交會的地方",
    words: 1300,
    focus: "把第一張票底、夜空座標、用戶問題合成一個核心命題，說明為何工作方向會成為當前卡點。",
  },
  {
    title: "第六章｜你總是坐在靠窗的位置",
    words: 1000,
    focus: "分析他在人際、感情、合作裡容易承擔過多、想穩住局面、又不容易求助的模式。",
  },
  {
    title: "第七章｜下一站該靠什麼抵達",
    words: 1200,
    focus: "解析適合的賺錢模式、工作定位、職涯選擇、短期與中期方向，用具體建議呈現。",
  },
  {
    title: "第八章｜如果不改，會重複的班次",
    words: 900,
    focus: "指出不調整時會重複的狀態：拖延選擇、過度承擔、對穩定的依賴、錯過機會。",
  },
  {
    title: "第九章｜下一站行動清單",
    words: 1100,
    focus: "給 30 天行動建議、溝通建議、工作決策建議、每日提醒，收束成小說式結尾。",
  },
];

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
    "路線交會摘要",
    `路線性質：${profile?.destinyType || "等待完整調度"}`,
    `夜空座標：${chart?.summary?.join(" / ") || "等待完整調度"}`,
    `用戶問題：${clean(passenger.concern) || "未填"}`,
    "",
    "已翻開的前幾頁",
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
  lines.push("正式付款開通後，這裡會改為依照用戶第一張票底、夜空座標與問題產生對應字數的小說式完整班次表。");

  return lines.join("\n");
}

function buildContext(payload: ClaimRequest) {
  const passenger = payload.passenger ?? {};
  const passengerSummary = [
    `姓名：${clean(passenger.name) || "未填"}`,
    `生日：${clean(passenger.birth) || "未填"}`,
    `出生時間：${passenger.unknownTime ? "不知道時間" : clean(passenger.time) || "未填"}`,
    `出生地：${clean(passenger.birthplace) || "未填"}`,
    `用戶目前最想逃開的問題：${clean(passenger.concern) || "未填"}`,
  ].join("\n");
  const chartSummary = payload.chartDisplay?.summary?.length
    ? payload.chartDisplay.summary.join(" / ")
    : "夜空座標暫無前端資料，請依姓名生日時間出生地做可讀性解讀。";

  return { passengerSummary, chartSummary };
}

function buildPrompt(payload: ClaimRequest) {
  const plan = getPlan(payload.productId);
  const { passengerSummary, chartSummary } = buildContext(payload);

  return [
    "你是第 13 月台 Destiny Archive 的命運檔案撰寫者。",
    "請用小說式但清楚可讀的繁體中文，根據第一張票底、夜空座標與用戶問題，輸出完整班次表。",
    `方案：${plan.name}，價格：${plan.paidPrice}，目標字數約 ${plan.targetWords} 字。`,
    "重要規則：下方乘客資料已經是有效輸入。禁止寫「尚未提供資料」「資料不足無法分析」「請補齊資料」這類句子。",
    "後端已把專業資料整理成可讀摘要。你可以使用這些資料，但輸出時不得出現禁用詞。",
    "禁用詞：八字、星盤、星座、命盤、五行、流年、大運、十神、命理、三叉分析。請改用第 13 月台語言。",
    "報告結構：開場、乘客資料確認、第一張票底、夜空座標、用戶問題解析、三條線交會、具體建議、下一站提醒。",
    "文字風格：像一本班次小說，但每一段都要有白話解釋，讓用戶覺得內容有落地、能對照自己。",
    "",
    "乘客資料：",
    passengerSummary,
    "",
    "夜空座標：",
    chartSummary,
    "",
    "已翻開的前幾頁：",
    JSON.stringify(payload.preview ?? {}),
  ].join("\n");
}

function buildArchiveSectionPrompt(payload: ClaimRequest, section: (typeof archiveSections)[number], index: number) {
  const { passengerSummary, chartSummary } = buildContext(payload);

  return [
    "你是第 13 月台 Destiny Archive 的命運檔案撰寫者。",
    "現在要撰寫 1980 方案「完整班次表」的一個章節。整份報告會由多個章節合併，所以這一章要完整、具體、可直接閱讀。",
    "重要規則：下方乘客資料已經是有效輸入。禁止寫「尚未提供資料」「資料不足無法分析」「請補齊資料」這類句子。",
    "文字風格：繁體中文、小說式班次檔案，但每段都要接白話解釋。不要只寫抽象形容，要能讓用戶對照工作、關係、金錢與選擇。",
    "禁用詞：八字、星盤、星座、命盤、五行、流年、大運、十神、命理、三叉分析。請改用第一張票底、夜空座標、能量氣候、下一站時間表、三條線交會等說法。",
    `本章標題：${section.title}`,
    `本章目標字數：約 ${section.words} 字。請盡量寫足，不要過短。`,
    `本章重點：${section.focus}`,
    "",
    "乘客資料：",
    passengerSummary,
    "",
    "夜空座標：",
    chartSummary,
    "",
    "已翻開的前幾頁：",
    JSON.stringify(payload.preview ?? {}),
    "",
    `請輸出格式：先寫「${section.title}」，接著分成 4 到 7 個小段落。這是第 ${index + 1} 章，不要寫總結整份報告。`,
  ].join("\n");
}

function buildTransferSectionPrompt(payload: ClaimRequest, section: ReportSection, index: number) {
  const { passengerSummary, chartSummary } = buildContext(payload);

  return [
    "你是第 13 月台 Destiny Archive 的命運檔案撰寫者。",
    "這是 1580 轉站套組的完整班次表，不是前幾頁，也不是簡短摘要。",
    "請用小說式班次解析風格撰寫：像列車長翻開命運檔案，一邊帶讀者看見自己的慣性，一邊給出具體可執行的提醒。",
    "報告必須根據三條線交會：第一張票底、夜空座標、使用者提出的問題。不要只寫心理雞湯。",
    "語氣要準、細膩、有畫面感，但不要恐嚇。每段都要有白話解釋，讓使用者知道這句話對現實生活代表什麼。",
    "禁用詞：八字、星盤、星座、命盤、五行、流年、大運、十神、命理、三叉分析。請全部轉成第 13 月台世界觀語言。",
    "不要出現「內容輸出白話」這種標籤。不要說資料不足。不要要求使用者補資料；若資料不完整，就根據已有資料做保守推論。",
    `目前章節：${section.title}`,
    `本章目標字數：約 ${section.words} 字，請寫足內容，不要只列點。`,
    `本章分析重點：${section.focus}`,
    "",
    "乘客資料：",
    passengerSummary,
    "",
    "已調度的夜空座標與路線摘要：",
    chartSummary,
    "",
    "已翻開的前幾頁：",
    JSON.stringify(payload.preview ?? {}),
    "",
    `請只輸出第 ${index + 1} 章正文，章節標題用「${section.title}」。`,
  ].join("\n");
}

function buildRouteSectionPrompt(payload: ClaimRequest, section: ReportSection, index: number) {
  const { passengerSummary, chartSummary } = buildContext(payload);

  return [
    "你是第 13 月台 Destiny Archive 的命運檔案撰寫者。",
    "這是 980 單程路線報告，請寫成短版但完整的小說式路線解析，不是前幾頁，也不是簡短摘要。",
    "報告要根據三條線交會：第一張票底、夜空座標、使用者提出的問題。",
    "語氣要準、細膩、有畫面感，但要讓使用者看得懂。每段都要有白話說明與實際提醒。",
    "禁用詞：八字、星盤、星座、命盤、五行、流年、大運、十神、命理、三叉分析。請全部轉成第 13 月台世界觀語言。",
    "不要出現「內容輸出白話」這種標籤。不要說資料不足。不要要求使用者補資料；若資料不完整，就根據已有資料做保守推論。",
    `目前章節：${section.title}`,
    `本章目標字數：約 ${section.words} 字，請寫足內容，不要只列點。`,
    `本章分析重點：${section.focus}`,
    "",
    "乘客資料：",
    passengerSummary,
    "",
    "已調度的夜空座標與路線摘要：",
    chartSummary,
    "",
    "已翻開的前幾頁：",
    JSON.stringify(payload.preview ?? {}),
    "",
    `請只輸出第 ${index + 1} 章正文，章節標題用「${section.title}」。`,
  ].join("\n");
}

async function requestOpenAIReport(prompt: string, maxOutputTokens: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
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
        max_output_tokens: maxOutputTokens,
      }),
    });

    const result = await upstream.json();
    if (!upstream.ok) throw new Error(result?.error?.message || "OpenAI request failed");

    return extractOutputText(result);
  } catch (error) {
    console.error("Report generation failed.", error);
    return "";
  }
}

async function generateArchiveReport(payload: ClaimRequest) {
  const generatedSections = await Promise.all(
    archiveSections.map(async (section, index) => {
      const prompt = withStoryLine(buildArchiveSectionPrompt(payload, section, index), archiveStoryLine);
      return requestOpenAIReport(prompt, 2600);
    }),
  );
  const sections = generatedSections.filter(Boolean);

  if (sections.length < Math.ceil(archiveSections.length / 2)) {
    return renderFallbackReport(payload);
  }

  const plan = getPlan(payload.productId);
  const { passengerSummary, chartSummary } = buildContext(payload);

  return [
    "第 13 月台 Destiny Archive",
    plan.name,
    "",
    "本次收到的資料",
    passengerSummary,
    "",
    "夜空座標",
    chartSummary,
    "",
    "────────────────",
    "",
    ...sections,
  ].join("\n\n");
}

async function generateRouteReport(payload: ClaimRequest) {
  const generatedSections = await Promise.all(
    routeSections.map(async (section, index) => {
      const prompt = withStoryLine(buildRouteSectionPrompt(payload, section, index), routeStoryLine);
      return requestOpenAIReport(prompt, 2200);
    }),
  );
  const sections = generatedSections.filter(Boolean);

  if (sections.length < Math.ceil(routeSections.length / 2)) {
    return renderFallbackReport(payload);
  }

  const plan = getPlan(payload.productId);
  const { passengerSummary, chartSummary } = buildContext(payload);

  return [
    "第 13 月台 Destiny Archive",
    plan.name,
    "",
    "乘客資料",
    passengerSummary,
    "",
    "路線交會摘要",
    chartSummary,
    "",
    "────────────────",
    "",
    ...sections,
  ].join("\n\n");
}

async function generateTransferReport(payload: ClaimRequest) {
  const generatedSections = await Promise.all(
    transferSections.map(async (section, index) => {
      const prompt = withStoryLine(buildTransferSectionPrompt(payload, section, index), transferStoryLine);
      return requestOpenAIReport(prompt, 2400);
    }),
  );
  const sections = generatedSections.filter(Boolean);

  if (sections.length < Math.ceil(transferSections.length / 2)) {
    return renderFallbackReport(payload);
  }

  const plan = getPlan(payload.productId);
  const { passengerSummary, chartSummary } = buildContext(payload);

  return [
    "第 13 月台 Destiny Archive",
    plan.name,
    "",
    "乘客資料",
    passengerSummary,
    "",
    "路線交會摘要",
    chartSummary,
    "",
    "────────────────",
    "",
    ...sections,
  ].join("\n\n");
}

async function generateReport(payload: ClaimRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return renderFallbackReport(payload);

  const plan = getPlan(payload.productId);

  if ((payload.productId ?? "archive") === "archive") {
    return generateArchiveReport(payload);
  }

  if (payload.productId === "transfer") {
    return generateTransferReport(payload);
  }

  if ((payload.productId ?? "route") === "route") {
    return generateRouteReport(payload);
  }

  const text = await requestOpenAIReport(buildPrompt(payload), plan.maxOutputTokens);
  return text || renderFallbackReport(payload);
}

function makeFilename(payload: ClaimRequest) {
  const passengerName = clean(payload.passenger?.name).replace(/[\\/:*?"<>|\s]+/g, "_") || "passenger";
  const plan = getPlan(payload.productId);
  return `第13月台_${plan.name}_${passengerName}.txt`;
}

function shouldSendIntroFirst(productId?: ProductId) {
  return productId === "transfer" || productId === "archive";
}

async function sendIntroWithResend(to: string, subject: string, payload: ClaimRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_resend_key" };

  const plan = getPlan(payload.productId);
  const passenger = payload.passenger ?? {};
  const from = process.env.REPORT_FROM_EMAIL || "第 13 月台 <onboarding@resend.dev>";
  const text = [
    "你的第 13 月台班次已經受理。",
    "",
    `方案：${plan.name}`,
    `價格：${plan.paidPrice}`,
    `收件信箱：${to}`,
    "",
    "乘客資料",
    `姓名：${clean(passenger.name) || "未填寫"}`,
    `生日：${clean(passenger.birth) || "未填寫"}`,
    `出生時間：${passenger.unknownTime ? "不知道時間" : clean(passenger.time) || "未填寫"}`,
    `出生地：${clean(passenger.birthplace) || "未填寫"}`,
    `目前問題：${clean(passenger.concern) || "未填寫"}`,
    "",
    "列車長凜正在整理你的完整班次檔案。",
    "這一份報告字數較長，會分段完成分析。",
    "待完整內容製作完成後，你會再收到第二封信，內含完整報告與 TXT 附件。",
    "",
    "你不需要重新送出資料，也不需要重複操作。",
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
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "intro email delivery failed");
  }

  return { sent: true };
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

async function generateAndSendFullReport(recipient: string, subject: string, payload: ClaimRequest) {
  const report = sanitizePassengerFacingText(await generateReport(payload));
  return sendWithResend(recipient, subject, report, payload);
}

async function legacyPOST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ClaimRequest;
    const recipient = clean(payload.recipientEmail) || fallbackRecipient;
    const plan = getPlan(payload.productId);
    const introPassengerName = clean(payload.passenger?.name) || "乘客";

    if (shouldSendIntroFirst(payload.productId)) {
      const introSubject = `第 13 月台｜你的班次已受理｜${introPassengerName}`;
      const fullSubject = `第 13 月台｜${plan.name}｜${introPassengerName}`;
      const introResult = await sendIntroWithResend(recipient, introSubject, payload);

      if (!introResult.sent) {
        return Response.json(
          {
            sent: false,
            message: "尚未設定 Resend 郵件金鑰，無法寄出受理通知。",
            reason: introResult.reason,
          },
          { status: 503 },
        );
      }

      await generateAndSendFullReport(recipient, fullSubject, payload);

      return Response.json({
        sent: true,
        queued: false,
        message: "已先寄出班次受理通知。完整報告製作完成後，會再寄出第二封信。",
      });
    }
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

async function queuedMemoryPOST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ClaimRequest;
    const recipient = clean(payload.recipientEmail) || fallbackRecipient;
    const plan = getPlan(payload.productId);
    const passengerName = clean(payload.passenger?.name) || "乘客";

    if (shouldSendIntroFirst(payload.productId)) {
      const job = createClaimJob({
        productId: payload.productId,
        planName: plan.name,
        recipient,
        passengerName,
      });
      const introSubject = `第 13 月台｜你的班次已受理｜${passengerName}`;
      const fullSubject = `第 13 月台｜${plan.name}｜${passengerName}`;
      const introResult = await sendIntroWithResend(recipient, introSubject, payload);

      if (!introResult.sent) {
        updateClaimJob(job.id, {
          status: "error",
          message: "受理通知寄送失敗。",
          error: introResult.reason,
        });
        return Response.json(
          {
            sent: false,
            jobId: job.id,
            message: "尚未設定 Resend 郵件金鑰，無法寄出受理通知。",
            reason: introResult.reason,
          },
          { status: 503 },
        );
      }

      updateClaimJob(job.id, {
        status: "generating",
        message: "受理通知已寄出，完整報告生成中。",
      });

      void generateAndSendFullReport(recipient, fullSubject, payload)
        .then(() => {
          updateClaimJob(job.id, {
            status: "sent",
            message: "完整報告已製作完成並寄出第二封信。",
          });
        })
        .catch((error) => {
          updateClaimJob(job.id, {
            status: "error",
            message: "完整報告生成或寄送失敗，請保留任務編號。",
            error: error instanceof Error ? error.message : "unknown error",
          });
          console.error("Full report background delivery failed.", error);
        });

      return Response.json({
        sent: true,
        queued: true,
        jobId: job.id,
        message: `已先寄出班次受理通知。完整報告正在後台生成，任務編號：${job.id}`,
      });
    }

    const subject = `第 13 月台｜${plan.name}｜${passengerName}`;
    const result = await generateAndSendFullReport(recipient, subject, payload);

    if (!result.sent) {
      return Response.json(
        {
          sent: false,
          message: "尚未設定 Resend 郵件金鑰，無法寄出完整報告。",
          reason: result.reason,
        },
        { status: 503 },
      );
    }

    return Response.json({
      sent: true,
      queued: false,
      message: `完整報告已寄出到 ${recipient}。`,
    });
  } catch (error) {
    console.error("Claim email failed.", error);
    return Response.json(
      {
        sent: false,
        message: error instanceof Error ? error.message : "寄送報告時發生錯誤。",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ClaimRequest;
    const recipient = clean(payload.recipientEmail) || fallbackRecipient;
    const plan = getPlan(payload.productId);
    const passengerName = clean(payload.passenger?.name) || "乘客";
    const subject = `第 13 月台｜${plan.name}｜${passengerName}`;

    if (shouldSendIntroFirst(payload.productId)) {
      const job = await createClaimJob({
        productId: payload.productId,
        planName: plan.name,
        recipient,
        passengerName,
        payload,
        fullSubject: subject,
      });

      const introResult = await sendIntroWithResend(recipient, `第 13 月台｜你的班次已受理｜${passengerName}`, payload);
      if (!introResult.sent) {
        await updateClaimJob(job.id, {
          status: "error",
          message: "受理通知寄送失敗。",
          error: introResult.reason,
        });
        return Response.json(
          {
            sent: false,
            jobId: job.id,
            message: "尚未設定 Resend 郵件金鑰，無法寄出受理通知。",
            reason: introResult.reason,
          },
          { status: 503 },
        );
      }

      await updateClaimJob(job.id, {
        status: "generating",
        message: "受理通知已寄出，完整報告生成中。",
      });

      void generateAndSendFullReport(recipient, subject, payload)
        .then(async () => {
          await updateClaimJob(job.id, {
            status: "sent",
            message: "完整報告已製作完成並寄出第二封信。",
          });
        })
        .catch(async (error) => {
          await updateClaimJob(job.id, {
            status: "error",
            message: "完整報告生成或寄送失敗，請保留任務編號。",
            error: error instanceof Error ? error.message : "unknown error",
          });
          console.error("Full report background delivery failed.", error);
        });

      return Response.json({
        sent: true,
        queued: true,
        jobId: job.id,
        message: `已先寄出班次受理通知。完整報告正在後台生成，任務編號：${job.id}`,
      });
    }

    const result = await generateAndSendFullReport(recipient, subject, payload);
    if (!result.sent) {
      return Response.json(
        {
          sent: false,
          message: "尚未設定 Resend 郵件金鑰，無法寄出完整報告。",
          reason: result.reason,
        },
        { status: 503 },
      );
    }

    return Response.json({
      sent: true,
      queued: false,
      message: `完整報告已寄出到 ${recipient}。`,
    });
  } catch (error) {
    console.error("Claim email failed.", error);
    return Response.json(
      {
        sent: false,
        message: error instanceof Error ? error.message : "寄送報告時發生錯誤。",
      },
      { status: 502 },
    );
  }
}
