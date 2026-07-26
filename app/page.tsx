"use client";

import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

type Stage =
  | "opening"
  | "enter"
  | "dialogue"
  | "intake"
  | "loading"
  | "reveal"
  | "teaser"
  | "free"
  | "payTeaser";

type IntakeStep = "name" | "birth" | "time" | "birthplace" | "concern" | "email" | "review";
type ProductId = "route" | "transfer" | "archive";

type Product = {
  name: string;
  tag: string;
  oldPrice: number;
  price: number;
  bullets: string[];
};

type DestinyChapter = {
  title: string;
  headline?: string;
  lines: string[];
};

type DestinyPreview = {
  recordStatus: string;
  chapters: {
    seen: DestinyChapter;
    inner: DestinyChapter;
    repeat: DestinyChapter;
    blindSpot: DestinyChapter;
    future: DestinyChapter;
  };
  profile: {
    title: string;
    destinyType: string;
    triangulation: string[];
    lines: string[];
  };
  locked: {
    title: string;
    chapters: string[];
    closingTitle: string;
    closingLine: string;
    cta: string;
  };
};

type NatalChartPoint = {
  key: string;
  symbol: string;
  sign: string;
  degreeInSign: number;
  x: number;
  y: number;
};

type NatalChartDisplay = {
  title: string;
  summary: string[];
  points: NatalChartPoint[];
};

const videos = {
  opening: "/videos/01-opening.mp4",
  enter: "/videos/02-enter-carriage.mp4",
  dialogue: "/videos/03-first-dialogue.mp4",
  intake: "/videos/04-intake-ticket.mp4",
  loading: "/videos/05-loading-train.mp4",
  reveal: "/videos/06-reveal-watch.mp4",
  teaser: "/videos/07-conductor-teaser.mp4",
  payTeaser: "/videos/09-pay-teaser.mp4",
};

const concernOptions = ["職涯卡關", "關係反覆", "金錢壓力", "方向感消失"];
const intakeSteps: IntakeStep[] = ["name", "birth", "time", "birthplace", "concern", "email", "review"];

const products: Record<ProductId, Product> = {
  route: {
    name: "第 13 月台路線報告",
    tag: "單程",
    oldPrice: 1680,
    price: 980,
    bullets: ["核心誤點模式", "未來 90 天轉站提醒", "一份行動處方"],
  },
  transfer: {
    name: "轉站套組",
    tag: "推薦",
    oldPrice: 2860,
    price: 1580,
    bullets: ["路線報告", "職涯與合作班次", "關係避雷時刻"],
  },
  archive: {
    name: "完整班次表",
    tag: "完整",
    oldPrice: 3680,
    price: 1980,
    bullets: ["完整人生路線", "金錢與關係分岔", "30 天轉站清單"],
  },
};

const productEntries = Object.entries(products) as Array<[ProductId, Product]>;
const stageOrder: Stage[] = [
  "opening",
  "enter",
  "dialogue",
  "intake",
  "loading",
  "reveal",
  "teaser",
  "free",
  "payTeaser",
];
const gatedVideoStages: Stage[] = ["opening", "enter", "dialogue", "reveal", "teaser", "payTeaser"];

const formatPrice = (value: number) => `NT$${value.toLocaleString("zh-TW")}`;

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
};

const formatTimeInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const getDateDigits = (value: string) => value.replace(/\D/g, "").slice(0, 8);

const isValidBirthDate = (value: string) => {
  const digits = getDateDigits(value);
  if (digits.length !== 8) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);
  return (
    year >= 1900 &&
    year <= 2099 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const isValidBirthTime = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length !== 4) return false;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2, 4));
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
};

const fallbackDestinyPreview: DestinyPreview = {
  recordStatus: "已建立命運檔案",
  chapters: {
    seen: {
      title: "第一章｜我看到的你",
      lines: ["你總是走在最前面。", "不是因為你喜歡領導。", "而是你很早就發現，很多事情只能靠自己。"],
      headline: "你的第一個人格特徵：Leader",
    },
    inner: {
      title: "第二章｜真正的你",
      lines: ["外表冷靜。", "內心敏感。", "越在乎的人，越容易沉默。"],
    },
    repeat: {
      title: "第三章｜一直重複的人生",
      lines: ["工作。你總是承擔。", "感情。你總是等待。", "人生。你總是比別人晚相信自己。"],
    },
    blindSpot: {
      title: "第五章｜你的盲點",
      headline: "你最大的敵人。",
      lines: ["不是失敗。", "而是凡事都想自己完成。"],
    },
    future: {
      title: "第六章｜如果不改",
      lines: ["如果繼續這樣。", "你可能會失去："],
      headline: "關係。健康。機會。",
    },
  },
  profile: {
    title: "第四章｜你的命格",
    destinyType: "開路者",
    triangulation: ["八字顯示你習慣先承擔壓力。", "星盤顯示你需要被看見，也害怕失控。", "你逃開的問題，剛好落在同一個選擇。"],
    lines: ["這不是偶然。", "三條線交會後，指向同一種命格。"],
  },
  locked: {
    title: "後續章節已鎖住",
    chapters: ["Chapter 07　你的愛情　LOCKED", "Chapter 08　你的財富　LOCKED", "Chapter 09　人生劇透　LOCKED"],
    closingTitle: "我已經完成第一部分。",
    closingLine: "但真正的故事，還沒有開始。",
    cta: "繼續查看後面的班次",
  },
};

const fallbackNatalChart: NatalChartDisplay = {
  title: "出生星盤預覽",
  summary: ["太陽 獅子", "月亮 摩羯", "上升 雙子"],
  points: [
    { key: "sun", symbol: "☉", sign: "獅子", degreeInSign: 5, x: 42, y: 43 },
    { key: "moon", symbol: "☽", sign: "摩羯", degreeInSign: 18, x: 28, y: 58 },
    { key: "ascendant", symbol: "ASC", sign: "雙子", degreeInSign: 12, x: 68, y: 51 },
    { key: "mercury", symbol: "☿", sign: "巨蟹", degreeInSign: 21, x: 61, y: 45 },
    { key: "venus", symbol: "♀", sign: "處女", degreeInSign: 9, x: 55, y: 67 },
    { key: "mars", symbol: "♂", sign: "天蠍", degreeInSign: 14, x: 36, y: 68 },
    { key: "jupiter", symbol: "♃", sign: "水瓶", degreeInSign: 3, x: 24, y: 49 },
    { key: "saturn", symbol: "♄", sign: "牡羊", degreeInSign: 27, x: 51, y: 36 },
  ],
};

function StageVideo({
  src,
  loop = true,
  dim = "strong",
  onEnded,
  soundEnabled,
  shouldPlay = true,
  poster,
}: {
  src: string;
  loop?: boolean;
  dim?: "soft" | "strong";
  onEnded?: () => void;
  soundEnabled: boolean;
  shouldPlay?: boolean;
  poster?: string;
}) {
  return (
    <video
      className={`stage-video ${dim}`}
      src={src}
      poster={poster}
      autoPlay={shouldPlay}
      muted={!soundEnabled}
      loop={loop}
      playsInline
      preload="auto"
      onEnded={onEnded}
    />
  );
}

function LoadingAnalysisVideo({ src, soundEnabled }: { src: string; soundEnabled: boolean }) {
  function loopWatchSegment(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    const restartAt = video.duration ? Math.min(6.2, Math.max(0, video.duration - 0.8)) : 6.2;
    video.currentTime = restartAt;
    void video.play();
  }

  return (
    <video
      className="stage-video soft"
      src={src}
      autoPlay
      muted={!soundEnabled}
      playsInline
      preload="auto"
      onEnded={loopWatchSegment}
    />
  );
}

function NatalChartReveal({ chart }: { chart: NatalChartDisplay }) {
  return (
    <div className="natal-reveal-still" aria-label="出生星盤預覽">
      <img src="/comic/story/13-natal-chart-still.png" alt="" />
      <div className="natal-chart-layer" aria-hidden="true">
        {chart.points.map((point) => (
          <span
            key={`${point.key}-${point.x}-${point.y}`}
            className={`natal-point natal-point-${point.key}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            {point.symbol}
          </span>
        ))}
      </div>
      <div className="natal-summary">
        <span>{chart.title}</span>
        <strong>{chart.summary.join(" · ")}</strong>
      </div>
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("opening");
  const [intakeStep, setIntakeStep] = useState<IntakeStep>("name");
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [time, setTime] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [birthplace, setBirthplace] = useState("");
  const [concern, setConcern] = useState("");
  const [email, setEmail] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductId>("archive");
  const [coupon, setCoupon] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [videoEnded, setVideoEnded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [destinyPreview, setDestinyPreview] = useState<DestinyPreview>(fallbackDestinyPreview);
  const [natalChart, setNatalChart] = useState<NatalChartDisplay>(fallbackNatalChart);
  const [analysisFinished, setAnalysisFinished] = useState(false);

  const displayName = name.trim() || "乘客";
  const selected = products[selectedProduct];
  const couponValue = coupon ? 180 : 0;
  const total = Math.max(selected.price - couponValue, 0);
  const stageIndex = stageOrder.indexOf(stage);
  const progress = Math.round(((stageIndex + 1) / stageOrder.length) * 100);
  const stepIndex = intakeSteps.indexOf(intakeStep);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const intakeReady =
    name.trim().length > 0 &&
    isValidBirthDate(birth) &&
    (unknownTime || isValidBirthTime(time)) &&
    birthplace.trim().length > 0 &&
    concern.length > 0 &&
    isEmailValid;

  const loadingText = useMemo(
    () => ["火車已進入隧道", "懷錶正在校準出發站", "命運檔案正在展開", "正在調度第一段班次"],
    [],
  );
  const [loadingLine, setLoadingLine] = useState(0);
  const [analysisReady, setAnalysisReady] = useState(false);
  const canRevealAnalysis = analysisReady && analysisFinished;
  const isVideoGateReady = !gatedVideoStages.includes(stage) || videoEnded;
  const hasVideoStage = stage !== "free";

  useEffect(() => {
    if (stage !== "loading") return;
    setLoadingLine(0);
    setAnalysisReady(false);
    const lineTimer = window.setInterval(() => {
      setLoadingLine((value) => (value + 1) % loadingText.length);
    }, 1800);
    const readyTimer = window.setTimeout(() => setAnalysisReady(true), 15000);
    return () => {
      window.clearInterval(lineTimer);
      window.clearTimeout(readyTimer);
    };
  }, [loadingText.length, stage]);

  useEffect(() => {
    setVideoEnded(!gatedVideoStages.includes(stage));
  }, [stage]);

  useEffect(() => {
    if (stage !== "intake") return;

    const root = document.documentElement;
    const body = document.body;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;

    function syncViewport() {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const keyboardOffset = Math.max(0, window.innerHeight - height - offsetTop);
      root.style.setProperty("--app-viewport-height", `${height}px`);
      root.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    }

    syncViewport();
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);

    return () => {
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--keyboard-offset");
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, [stage]);

  function resetFlow() {
    setStage("opening");
    setIntakeStep("name");
    setCheckoutOpen(false);
    setJourneyStarted(false);
    setSoundEnabled(false);
    setVideoEnded(false);
  }

  function goBack() {
    setCheckoutOpen(false);

    if (stage === "opening") {
      resetFlow();
      return;
    }

    if (stage === "intake" && stepIndex > 0) {
      previousIntakeStep();
      return;
    }

    const previousStages: Partial<Record<Stage, Stage>> = {
      enter: "opening",
      dialogue: "enter",
      intake: "dialogue",
      loading: "intake",
      reveal: "loading",
      teaser: "reveal",
      free: "teaser",
      payTeaser: "free",
    };
    const previousStage = previousStages[stage];

    if (!previousStage) {
      resetFlow();
      return;
    }

    if (previousStage === "opening") {
      setJourneyStarted(false);
      setSoundEnabled(false);
    }

    setVideoEnded(!gatedVideoStages.includes(previousStage));
    setStage(previousStage);
  }

  function openIntake() {
    setIntakeStep("name");
    setVideoEnded(true);
    setStage("intake");
  }

  function startAnalysis() {
    setAnalysisReady(false);
    setAnalysisFinished(false);
    setNotice("");
    setStage("loading");

    void fetch("/api/destiny", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        birth,
        time,
        unknownTime,
        birthplace,
        concern,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { preview?: DestinyPreview; chartDisplay?: NatalChartDisplay; error?: string };
        if (!response.ok || !data.preview) {
          throw new Error(data.error || "班次表暫時無法校準");
        }
        setDestinyPreview(data.preview);
        setNatalChart(data.chartDisplay || fallbackNatalChart);
      })
      .catch(() => {
        setDestinyPreview(fallbackDestinyPreview);
        setNatalChart(fallbackNatalChart);
        setNotice("班次表先用預覽模式開啟。正式生成需要在 Railway Variables 加入新的 OPENAI_API_KEY。");
      })
      .finally(() => setAnalysisFinished(true));
  }

  function isCurrentStepReady() {
    switch (intakeStep) {
      case "name":
        return name.trim().length > 0;
      case "birth":
        return isValidBirthDate(birth);
      case "time":
        return unknownTime || isValidBirthTime(time);
      case "birthplace":
        return birthplace.trim().length > 0;
      case "concern":
        return concern.length > 0;
      case "email":
        return isEmailValid;
      case "review":
        return intakeReady;
      default:
        return false;
    }
  }

  function nextIntakeStep() {
    const nextStep = intakeSteps[stepIndex + 1];
    if (nextStep) setIntakeStep(nextStep);
  }

  function previousIntakeStep() {
    const previousStep = intakeSteps[stepIndex - 1];
    if (previousStep) setIntakeStep(previousStep);
  }

  function enableSound() {
    setSoundEnabled(true);
    window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
        video.muted = false;
        video.volume = 1;
        void video.play().catch(() => undefined);
      });
    });
  }

  function startJourney() {
    setJourneyStarted(true);
    setVideoEnded(false);
    enableSound();
  }

  function finishOpeningVideo() {
    setVideoEnded(true);
    setStage("enter");
  }

  return (
    <main className={stage === "intake" ? "site-shell intake-active" : "site-shell"}>
      <section className="phone-frame" aria-label="第 13 月台互動體驗">
        <div className="topbar">
          <button className="icon-button" onClick={goBack} aria-label="上一段">
            ‹
          </button>
          <div className="progress-track" aria-label={`流程進度 ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <button className="icon-button" onClick={resetFlow} aria-label="回到首頁">
            ⌂
          </button>
        </div>

        {hasVideoStage && journeyStarted && !soundEnabled && (
          <button className="sound-button" onClick={enableSound} type="button">
            開聲音
          </button>
        )}

        {stage === "opening" && (
          <section className="scene scene-hero">
            {!journeyStarted && <div className="opening-poster" aria-hidden="true" />}
            <StageVideo
              src={videos.opening}
              loop={false}
              soundEnabled={soundEnabled}
              shouldPlay={journeyStarted}
              poster="/opening-poster.jpg"
              onEnded={finishOpeningVideo}
            />
            {!journeyStarted && (
              <div className="scene-copy bottom delayed-copy">
                <p className="kicker">今晚 23:13</p>
                <h1>第 13 月台</h1>
                <p>你收到一張沒有寄件人的車票。目的地寫著：你一直不敢去的人生。</p>
                <button className="primary-button" onClick={startJourney} type="button">
                  查看手上的票
                </button>
              </div>
            )}
          </section>
        )}

        {stage === "enter" && (
          <section className="scene cinematic-scene">
            <StageVideo src={videos.enter} loop={false} soundEnabled={soundEnabled} onEnded={() => setVideoEnded(true)} />
            {isVideoGateReady && (
              <div className="scene-copy bottom delayed-copy">
                <p className="line">你手上的票，不是通往遠方，是通往你一直避開的那一站。</p>
                <button className="primary-button" onClick={() => setStage("dialogue")}>
                  進入車廂
                </button>
              </div>
            )}
          </section>
        )}

        {stage === "dialogue" && (
          <section className="scene cinematic-scene">
            <StageVideo src={videos.dialogue} loop={false} soundEnabled={soundEnabled} onEnded={() => setVideoEnded(true)} />
            {isVideoGateReady && (
              <div className="scene-copy bottom delayed-copy">
                <p className="line">你終於來了。第 13 月台，從不等錯的人。</p>
                <div className="choice-list">
                  <button className="choice-button" onClick={openIntake}>
                    把車票交給凜
                  </button>
                  <button className="choice-button" onClick={openIntake}>
                    坐下，讓他核對
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {stage === "intake" && (
          <section className="scene intake-scene">
            <StageVideo
              src={videos.intake}
              loop={false}
              soundEnabled={soundEnabled}
              onEnded={() => setVideoEnded(true)}
            />
            <div className="scene-copy form-panel delayed-copy">
              <p className="kicker">核對車票</p>
              <h2 className="intake-title">姓名。生日。出生地。還有你最近最想逃開的問題。</h2>

              <div className="ticket-step-card">
                <div className="step-count">
                  <span>
                    {stepIndex + 1}/{intakeSteps.length}
                  </span>
                  <div className="step-dots" aria-label="核對進度">
                    {intakeSteps.map((step) => (
                      <i key={step} className={intakeSteps.indexOf(step) <= stepIndex ? "active" : ""} />
                    ))}
                  </div>
                </div>

                {intakeStep === "name" && (
                  <label className="single-field">
                    乘客稱呼
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="你的名字或暱稱"
                    />
                  </label>
                )}

                {intakeStep === "birth" && (
                  <label className="single-field">
                      出生日期
                    <input
                      value={birth}
                      onChange={(event) => setBirth(formatDateInput(event.target.value))}
                      placeholder="1996/08/21"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </label>
                )}

                {intakeStep === "time" && (
                  <div className="single-field">
                    <label>
                      出生時間
                      <input
                        value={time}
                        onChange={(event) => setTime(formatTimeInput(event.target.value))}
                        placeholder="13:30"
                        disabled={unknownTime}
                        inputMode="numeric"
                        maxLength={5}
                      />
                    </label>
                    <button
                      className={unknownTime ? "pill-option active" : "pill-option"}
                      onClick={() => setUnknownTime((value) => !value)}
                      type="button"
                    >
                      不知道時間
                    </button>
                  </div>
                )}

                {intakeStep === "birthplace" && (
                  <label className="single-field">
                    出生地 / 第一個出發站
                    <input
                      value={birthplace}
                      onChange={(event) => setBirthplace(event.target.value)}
                      placeholder="台北、台中、香港..."
                    />
                  </label>
                )}

                {intakeStep === "concern" && (
                  <div className="option-group single-field" aria-label="最近最想逃開的問題">
                    <p>最近最想逃開的問題</p>
                    <div className="segmented">
                      {concernOptions.map((option) => (
                        <button
                          key={option}
                          className={concern === option ? "active" : ""}
                          onClick={() => setConcern(option)}
                          type="button"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {intakeStep === "email" && (
                  <label className="single-field">
                    接收班次表信箱
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="example@mail.com"
                      type="email"
                    />
                  </label>
                )}

                {intakeStep === "review" && (
                  <div className="ticket-summary">
                    <p className="small-title">核對完成</p>
                    <dl>
                      <div>
                        <dt>稱呼</dt>
                        <dd>{displayName}</dd>
                      </div>
                      <div>
                        <dt>出生日期</dt>
                        <dd>{birth}</dd>
                      </div>
                      <div>
                        <dt>出生時間</dt>
                        <dd>{unknownTime ? "時間未知" : time}</dd>
                      </div>
                      <div>
                        <dt>出發站</dt>
                        <dd>{birthplace}</dd>
                      </div>
                      <div>
                        <dt>問題</dt>
                        <dd>{concern}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                <div className="step-actions">
                  <button
                    className="secondary-button"
                    onClick={previousIntakeStep}
                    disabled={stepIndex === 0}
                    type="button"
                  >
                    上一步
                  </button>
                  {intakeStep === "review" ? (
                    <button
                      className="primary-button"
                      disabled={!intakeReady}
                      onClick={startAnalysis}
                    >
                      開始查詢班次
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      disabled={!isCurrentStepReady()}
                      onClick={nextIntakeStep}
                      type="button"
                    >
                      下一項
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {stage === "loading" && (
          <section className="scene loading-scene" aria-live="polite">
            <LoadingAnalysisVideo src={videos.loading} soundEnabled={soundEnabled} />
            <div className="scene-copy center">
              <p className="kicker">命運檔案調度中</p>
              <h2>{loadingText[loadingLine]}</h2>
              <p className="analysis-note">
                {canRevealAnalysis
                  ? "懷錶已停在你的第一段路線。"
                  : "懷錶會停在這裡循環等待，直到班次表完成校準。"}
              </p>
              {notice && <p className="analysis-note subtle-note">{notice}</p>}
              {canRevealAnalysis && (
                <button className="primary-button analysis-button" onClick={() => setStage("reveal")}>
                  翻開第一頁
                </button>
              )}
            </div>
          </section>
        )}

        {stage === "reveal" && (
          <section className="scene cinematic-scene">
            <StageVideo src={videos.reveal} loop={false} dim="soft" soundEnabled={soundEnabled} onEnded={() => setVideoEnded(true)} />
            {isVideoGateReady && (
              <div className="scene-copy bottom delayed-copy">
                <p className="line">你的路線沒有消失，只是被你自己延後了。</p>
                <button className="primary-button" onClick={() => setStage("teaser")}>
                  看見完整班次表
                </button>
              </div>
            )}
          </section>
        )}

        {stage === "teaser" && (
          <section className="scene cinematic-scene">
            <StageVideo src={videos.teaser} loop={false} soundEnabled={soundEnabled} onEnded={() => setVideoEnded(true)} />
            {isVideoGateReady && (
              <>
                <NatalChartReveal chart={natalChart} />
              <div className="scene-copy bottom delayed-copy chart-reveal-copy">
                <p className="line">完整班次表在我手上。要不要看看，下一站會把你帶去哪？</p>
                <button className="primary-button" onClick={() => setStage("free")}>
                  翻開第一頁
                </button>
              </div>
              </>
            )}
          </section>
        )}

        {stage === "free" && (
          <section className="story-scroll">
            <article className="story-panel" style={{ backgroundImage: "url('/comic/story/01-fate-train.png')" }}>
              <div className="story-copy lower">
                <span>Chapter 1</span>
                <h2>命運列車</h2>
                <p>你不是偶然上車。</p>
                <p>只是這一次，有人終於替你開門。</p>
              </div>
            </article>
            <article className="story-panel" style={{ backgroundImage: "url('/comic/story/02-enter-carriage.png')" }}>
              <div className="story-copy lower">
                <span>下一節車廂</span>
                <h2>進來吧。</h2>
                <p>你的檔案，已經在等你了。</p>
              </div>
            </article>
            <article className="story-panel" style={{ backgroundImage: "url('/comic/story/03-sit-down.png')" }}>
              <div className="story-copy lower">
                <span>請坐</span>
                <h2>接下來看到的，不是占卜。</h2>
                <p>是你一直沒有整理過的人生紀錄。</p>
              </div>
            </article>
            <article className="story-panel" style={{ backgroundImage: "url('/comic/story/04-destiny-book.png')" }}>
              <div className="story-copy lower">
                <span>Destiny Archive</span>
                <h2>這本書不是普通書。</h2>
                <p>每翻一頁，就是一次分析。</p>
              </div>
            </article>
            <article className="story-panel book-panel" style={{ backgroundImage: "url('/comic/story/05-record-cover.png')" }}>
              <div className="archive-page cover-page">
                <span>DESTINY RECORD</span>
                <i />
                <dl>
                  <div>
                    <dt>Name</dt>
                    <dd>{displayName}</dd>
                  </div>
                  <div>
                    <dt>Birth</dt>
                    <dd>{birth || "尚未填寫"}</dd>
                  </div>
                  <div>
                    <dt>Birthplace</dt>
                    <dd>{birthplace || "尚未填寫"}</dd>
                  </div>
                </dl>
                <p>{destinyPreview.recordStatus}</p>
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/06-analysis-page.png')" }}>
              <div className="archive-page page-overlay analysis-page">
                <span>{destinyPreview.chapters.seen.title}</span>
                {destinyPreview.chapters.seen.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {destinyPreview.chapters.seen.headline && <strong>{destinyPreview.chapters.seen.headline}</strong>}
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/06-analysis-page.png')" }}>
              <div className="archive-page page-overlay analysis-page">
                <span>{destinyPreview.chapters.inner.title}</span>
                {destinyPreview.chapters.inner.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/06-analysis-page.png')" }}>
              <div className="archive-page page-overlay analysis-page">
                <span>{destinyPreview.chapters.repeat.title}</span>
                {destinyPreview.chapters.repeat.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/09-destiny-profile.png')" }}>
              <div className="archive-page page-overlay report-page">
                <span>{destinyPreview.profile.title}</span>
                <strong>{destinyPreview.profile.destinyType}</strong>
                {destinyPreview.profile.triangulation.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {destinyPreview.profile.lines.map((line) => (
                  <em key={line}>{line}</em>
                ))}
              </div>
            </article>
            <article className="story-panel" style={{ backgroundImage: "url('/comic/story/10-blind-spot.png')" }}>
              <div className="story-copy lower">
                <span>{destinyPreview.chapters.blindSpot.title}</span>
                <h2>{destinyPreview.chapters.blindSpot.headline}</h2>
                {destinyPreview.chapters.blindSpot.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
            <article className="story-panel book-panel" style={{ backgroundImage: "url('/comic/story/11-if-not-change.png')" }}>
              <div className="archive-page split-page">
                <span>{destinyPreview.chapters.future.title}</span>
                {destinyPreview.chapters.future.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {destinyPreview.chapters.future.headline && <strong>{destinyPreview.chapters.future.headline}</strong>}
              </div>
            </article>
            <article className="story-panel book-panel final-lock" style={{ backgroundImage: "url('/comic/story/12-locked-chapters.png')" }}>
              <div className="archive-page locked-page">
                <span>{destinyPreview.locked.title}</span>
                {destinyPreview.locked.chapters.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="story-copy final-copy">
                <h2>{destinyPreview.locked.closingTitle}</h2>
                <p>{destinyPreview.locked.closingLine}</p>
                <button className="primary-button comic-next-button" onClick={() => setStage("payTeaser")}>
                  {destinyPreview.locked.cta}
                </button>
              </div>
            </article>
          </section>
        )}

        {stage === "payTeaser" && (
          <section className="scene cinematic-scene">
            <StageVideo src={videos.payTeaser} loop={false} soundEnabled={soundEnabled} onEnded={() => setVideoEnded(true)} />
            {isVideoGateReady && (
              <div className="scene-copy bottom delayed-copy">
                <p className="line">免費路線到這裡。後面的班次，要不要繼續查？</p>
                <button className="primary-button" onClick={() => setCheckoutOpen(true)}>
                  解鎖完整班次表
                </button>
              </div>
            )}
          </section>
        )}

        {checkoutOpen && (
          <div className="modal-backdrop">
            <section
              className="checkout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-title"
              aria-describedby="checkout-desc"
            >
              <button
                className="modal-close"
                aria-label="關閉付款選擇"
                onClick={() => setCheckoutOpen(false)}
              >
                ×
              </button>
              <h2 id="checkout-title">完整班次表方案</h2>
              <p id="checkout-desc">這是原型付款彈窗，按鈕不會真的收款。</p>
              <div className="product-list">
                {productEntries.map(([id, product]) => (
                  <button
                    key={id}
                    className={selectedProduct === id ? "product active" : "product"}
                    onClick={() => setSelectedProduct(id)}
                    type="button"
                  >
                    <span>{product.tag}</span>
                    <strong>{product.name}</strong>
                    <small>{product.bullets.join(" / ")}</small>
                    <em>
                      <s>{formatPrice(product.oldPrice)}</s>
                      {formatPrice(product.price)}
                    </em>
                  </button>
                ))}
              </div>
              <div className="receipt">
                <span>商品原價</span>
                <strong>{formatPrice(selected.oldPrice)}</strong>
                <span>限時折抵</span>
                <strong>-{formatPrice(selected.oldPrice - selected.price)}</strong>
                <button type="button" onClick={() => setCoupon((value) => !value)}>
                  {coupon ? "已套用月台券" : "套用月台券"}
                </button>
                <strong>{coupon ? `-${formatPrice(couponValue)}` : "未套用"}</strong>
                <span>本次合計</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(event) => setPrivacy(event.target.checked)}
                />
                我同意資料只用於產生本次班次表
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(event) => setTerms(event.target.checked)}
                />
                我了解這是娛樂與自我探索內容
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(event) => setMarketing(event.target.checked)}
                />
                願意收到後續路線更新
              </label>
              <button
                className="pay-button"
                disabled={!privacy || !terms}
                onClick={() => setNotice("原型完成：這裡之後可串接金流或會員系統。")}
              >
                前往解鎖
              </button>
              {notice && <p className="notice">{notice}</p>}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
