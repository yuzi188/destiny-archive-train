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
const gatedVideoStages: Stage[] = ["opening", "enter", "dialogue", "intake", "reveal", "teaser", "payTeaser"];

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

function StageVideo({
  src,
  loop = true,
  dim = "strong",
  onEnded,
  soundEnabled,
  shouldPlay = true,
}: {
  src: string;
  loop?: boolean;
  dim?: "soft" | "strong";
  onEnded?: () => void;
  soundEnabled: boolean;
  shouldPlay?: boolean;
}) {
  return (
    <video
      className={`stage-video ${dim}`}
      src={src}
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
    birth.length >= 10 &&
    (unknownTime || time.length >= 5) &&
    birthplace.trim().length > 0 &&
    concern.length > 0 &&
    isEmailValid;

  const loadingText = useMemo(
    () => ["火車已進入隧道", "懷錶正在校準出發站", "命運檔案正在展開", "正在調度第一段班次"],
    [],
  );
  const [loadingLine, setLoadingLine] = useState(0);
  const [analysisReady, setAnalysisReady] = useState(false);
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

  function resetFlow() {
    setStage("opening");
    setIntakeStep("name");
    setCheckoutOpen(false);
    setJourneyStarted(false);
    setSoundEnabled(false);
  }

  function openIntake() {
    setIntakeStep("name");
    setStage("intake");
  }

  function startAnalysis() {
    setAnalysisReady(false);
    setStage("loading");
  }

  function isCurrentStepReady() {
    switch (intakeStep) {
      case "name":
        return name.trim().length > 0;
      case "birth":
        return birth.length >= 10;
      case "time":
        return unknownTime || time.length >= 5;
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
    enableSound();
  }

  return (
    <main className={stage === "intake" ? "site-shell intake-active" : "site-shell"}>
      <section className="phone-frame" aria-label="第 13 月台互動體驗">
        <div className="topbar">
          <button className="icon-button" onClick={resetFlow} aria-label="回到開場">
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
            <StageVideo
              src={videos.opening}
              loop={false}
              soundEnabled={soundEnabled}
              shouldPlay={journeyStarted}
              onEnded={() => setVideoEnded(true)}
            />
            {!journeyStarted && (
              <div className="start-gate">
                <p className="kicker">第 13 月台</p>
                <h1>命運列車即將進站</h1>
                <button className="primary-button" onClick={startJourney} type="button">
                  啟程
                </button>
              </div>
            )}
            {isVideoGateReady && (
              <div className="scene-copy bottom delayed-copy">
                <p className="kicker">今晚 23:13</p>
                <h1>第 13 月台</h1>
                <p>你收到一張沒有寄件人的車票。目的地寫著：你一直不敢去的人生。</p>
                <button className="primary-button" onClick={() => setStage("enter")}>
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
            <StageVideo src={videos.intake} loop={false} soundEnabled={soundEnabled} onEnded={() => setVideoEnded(true)} />
            {isVideoGateReady && (
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
            )}
          </section>
        )}

        {stage === "loading" && (
          <section className="scene loading-scene" aria-live="polite">
            <LoadingAnalysisVideo src={videos.loading} soundEnabled={soundEnabled} />
            <div className="scene-copy center">
              <p className="kicker">命運檔案調度中</p>
              <h2>{loadingText[loadingLine]}</h2>
              <p className="analysis-note">
                {analysisReady
                  ? "懷錶已停在你的第一段路線。"
                  : "懷錶會停在這裡循環等待，直到班次表完成校準。"}
              </p>
              {analysisReady && (
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
              <div className="scene-copy bottom delayed-copy">
                <p className="line">完整班次表在我手上。要不要看看，下一站會把你帶去哪？</p>
                <button className="primary-button" onClick={() => setStage("free")}>
                  翻開第一頁
                </button>
              </div>
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
                <p>已建立命運檔案</p>
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/06-analysis-page.png')" }}>
              <div className="archive-page page-overlay analysis-page">
                <span>第一章｜我看到的你</span>
                <p>你總是走在最前面。</p>
                <p>不是因為你喜歡領導。</p>
                <p>而是你很早就發現，很多事情只能靠自己。</p>
                <strong>你的第一個人格特徵：Leader</strong>
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/06-analysis-page.png')" }}>
              <div className="archive-page page-overlay analysis-page">
                <span>第二章｜真正的你</span>
                <p>外表冷靜。</p>
                <p>內心敏感。</p>
                <p>越在乎的人，越容易沉默。</p>
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/06-analysis-page.png')" }}>
              <div className="archive-page page-overlay analysis-page">
                <span>第三章｜一直重複的人生</span>
                <p>工作。你總是承擔。</p>
                <p>感情。你總是等待。</p>
                <p>人生。你總是比別人晚相信自己。</p>
              </div>
            </article>
            <article className="story-panel book-panel aligned-book" style={{ backgroundImage: "url('/comic/story/09-destiny-profile.png')" }}>
              <div className="archive-page page-overlay report-page">
                <span>第四章｜你的命格</span>
                <strong>核心人格　Leader</strong>
                <p>火元素 <b style={{ width: "72%" }} /></p>
                <p>理性 <b style={{ width: "58%" }} /></p>
                <p>情感 <b style={{ width: "34%" }} /></p>
                <p>行動力 <b style={{ width: "68%" }} /></p>
              </div>
            </article>
            <article className="story-panel" style={{ backgroundImage: "url('/comic/story/10-blind-spot.png')" }}>
              <div className="story-copy lower">
                <span>第五章｜你的盲點</span>
                <h2>你最大的敵人。</h2>
                <p>不是失敗。</p>
                <p>而是凡事都想自己完成。</p>
              </div>
            </article>
            <article className="story-panel book-panel" style={{ backgroundImage: "url('/comic/story/11-if-not-change.png')" }}>
              <div className="archive-page split-page">
                <span>第六章｜如果不改</span>
                <p>如果繼續這樣。</p>
                <p>你可能會失去：</p>
                <strong>關係。健康。機會。</strong>
              </div>
            </article>
            <article className="story-panel book-panel final-lock" style={{ backgroundImage: "url('/comic/story/12-locked-chapters.png')" }}>
              <div className="archive-page locked-page">
                <span>後續章節已鎖住</span>
                <p>Chapter 07　你的愛情　LOCKED</p>
                <p>Chapter 08　你的財富　LOCKED</p>
                <p>Chapter 09　人生劇透　LOCKED</p>
              </div>
              <div className="story-copy final-copy">
                <h2>我已經完成第一部分。</h2>
                <p>但真正的故事，還沒有開始。</p>
                <button className="primary-button comic-next-button" onClick={() => setStage("payTeaser")}>
                  繼續查看後面的班次
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
