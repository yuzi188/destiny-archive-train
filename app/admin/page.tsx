"use client";

import { useEffect, useMemo, useState } from "react";

type ClaimJobStatus = "queued" | "generating" | "sent" | "error";

type ClaimJob = {
  id: string;
  status: ClaimJobStatus;
  productId?: string;
  planName?: string;
  recipient: string;
  passengerName: string;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

type AdminResponse = {
  jobs: ClaimJob[];
  database: boolean;
  protected: boolean;
  generatedAt: string;
  error?: string;
};

const statusLabels: Record<ClaimJobStatus, string> = {
  queued: "等待中",
  generating: "生成中",
  sent: "已寄出",
  error: "失敗",
};

const statusColors: Record<ClaimJobStatus, string> = {
  queued: "#d8b36d",
  generating: "#78c6ff",
  sent: "#8ee6a8",
  error: "#ff6b62",
};

const userStorageKey = "destiny-admin-user";
const passwordStorageKey = "destiny-admin-password";

function formatDate(value?: string) {
  if (!value) return "尚未完成";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminPage() {
  const [jobs, setJobs] = useState<ClaimJob[]>([]);
  const [adminUser, setAdminUser] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [database, setDatabase] = useState(false);
  const [isProtected, setIsProtected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const counts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.total += 1;
        acc[job.status] += 1;
        return acc;
      },
      { total: 0, queued: 0, generating: 0, sent: 0, error: 0 },
    );
  }, [jobs]);

  async function loadJobs(nextUser = adminUser, nextPassword = adminPassword) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/claims?limit=150", {
        headers:
          nextUser || nextPassword
            ? {
                "x-admin-user": nextUser,
                "x-admin-password": nextPassword,
              }
            : undefined,
        cache: "no-store",
      });
      const data = (await response.json()) as AdminResponse;

      if (!response.ok) {
        setMessage(data.error || "後台資料讀取失敗。");
        return;
      }

      setJobs(data.jobs || []);
      setDatabase(Boolean(data.database));
      setIsProtected(Boolean(data.protected));
      setLastUpdated(formatDate(data.generatedAt));
    } catch {
      setMessage("後台暫時連不上，稍後再刷新一次。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedUser = localStorage.getItem(userStorageKey) || "";
    const savedPassword = localStorage.getItem(passwordStorageKey) || "";

    if (savedUser) setAdminUser(savedUser);
    if (savedPassword) setAdminPassword(savedPassword);

    loadJobs(savedUser, savedPassword);
    const timer = window.setInterval(() => loadJobs(savedUser, savedPassword), 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveLogin() {
    localStorage.setItem(userStorageKey, adminUser);
    localStorage.setItem(passwordStorageKey, adminPassword);
    loadJobs(adminUser, adminPassword);
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.kicker}>Destiny Archive</p>
            <h1 style={styles.title}>第 13 月台後台</h1>
            <p style={styles.subtitle}>查看完整報告訂單、生成進度、寄送狀態與失敗原因。</p>
          </div>
          <button type="button" onClick={() => loadJobs()} style={styles.refreshButton}>
            {loading ? "刷新中" : "重新整理"}
          </button>
        </header>

        <section style={styles.noticeRow}>
          <span style={database ? styles.goodDot : styles.warnDot} />
          <p style={styles.noticeText}>
            {database ? "資料庫已連上，訂單會保留。" : "尚未連到資料庫，目前只會保留在伺服器記憶體。"}
          </p>
          <span style={isProtected ? styles.goodDot : styles.warnDot} />
          <p style={styles.noticeText}>{isProtected ? "後台已上鎖。" : "尚未設定後台帳密，公開網址可讀後台。"}</p>
        </section>

        <section style={styles.loginPanel}>
          <label style={styles.loginLabel}>
            後台帳號
            <input
              value={adminUser}
              onChange={(event) => setAdminUser(event.target.value)}
              placeholder="輸入後台帳號"
              style={styles.input}
              type="text"
            />
          </label>
          <label style={styles.loginLabel}>
            後台密碼
            <input
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="輸入後台密碼"
              style={styles.input}
              type="password"
            />
          </label>
          <button type="button" onClick={saveLogin} style={styles.smallButton}>
            登入後台
          </button>
        </section>

        {message ? <p style={styles.errorText}>{message}</p> : null}

        <section style={styles.statsGrid}>
          <StatCard label="全部訂單" value={counts.total} tone="#f7efe4" />
          <StatCard label="等待中" value={counts.queued} tone={statusColors.queued} />
          <StatCard label="生成中" value={counts.generating} tone={statusColors.generating} />
          <StatCard label="已寄出" value={counts.sent} tone={statusColors.sent} />
          <StatCard label="失敗" value={counts.error} tone={statusColors.error} />
        </section>

        <section style={styles.listHeader}>
          <h2 style={styles.sectionTitle}>報告任務</h2>
          <span style={styles.updatedText}>最後更新：{lastUpdated || "讀取中"}</span>
        </section>

        <section style={styles.jobList}>
          {jobs.length === 0 && !loading ? <div style={styles.emptyState}>目前還沒有訂單資料。</div> : null}

          {jobs.map((job) => (
            <article key={job.id} style={styles.jobCard}>
              <div style={styles.jobTop}>
                <div>
                  <p style={styles.jobId}>{job.id}</p>
                  <h3 style={styles.jobTitle}>{job.planName || job.productId || "未命名方案"}</h3>
                </div>
                <span
                  style={{
                    ...styles.statusBadge,
                    color: statusColors[job.status],
                    borderColor: `${statusColors[job.status]}66`,
                    background: `${statusColors[job.status]}1f`,
                  }}
                >
                  {statusLabels[job.status]}
                </span>
              </div>

              <dl style={styles.metaGrid}>
                <Meta label="乘客" value={job.passengerName || "未提供"} />
                <Meta label="信箱" value={job.recipient} />
                <Meta label="建立" value={formatDate(job.createdAt)} />
                <Meta label="更新" value={formatDate(job.updatedAt)} />
                <Meta label="完成" value={formatDate(job.completedAt)} />
              </dl>

              <p style={styles.jobMessage}>{job.message}</p>
              {job.error ? <p style={styles.jobError}>{job.error}</p> : null}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={{ ...styles.statValue, color: tone }}>{value}</strong>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metaItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 12% 0%, rgba(120, 198, 255, 0.14), transparent 24rem), radial-gradient(circle at 88% 10%, rgba(212, 76, 76, 0.12), transparent 24rem), #070809",
    color: "#f7efe4",
    padding: "28px 16px 56px",
  },
  shell: {
    width: "min(1120px, 100%)",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  kicker: {
    margin: "0 0 8px",
    color: "#d8b36d",
    fontSize: 13,
    fontWeight: 900,
  },
  title: {
    margin: "0 0 8px",
    fontSize: "clamp(30px, 5vw, 48px)",
    lineHeight: 1.08,
  },
  subtitle: {
    margin: 0,
    color: "#b9c6c6",
    fontSize: 15,
  },
  refreshButton: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 8,
    background: "linear-gradient(135deg, #78c6ff, #d8b36d 52%, #d44c4c)",
    color: "#130c08",
    fontWeight: 900,
  },
  noticeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
    padding: 12,
    border: "1px solid rgba(247, 239, 228, 0.12)",
    borderRadius: 8,
    background: "rgba(17, 21, 23, 0.72)",
  },
  goodDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#8ee6a8",
    boxShadow: "0 0 16px rgba(142, 230, 168, 0.42)",
  },
  warnDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#d8b36d",
    boxShadow: "0 0 16px rgba(216, 179, 109, 0.42)",
  },
  noticeText: {
    margin: "0 16px 0 0",
    color: "#d9e2e1",
    fontSize: 13,
  },
  loginPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) auto",
    gap: 10,
    alignItems: "end",
    marginBottom: 18,
    padding: 12,
    border: "1px solid rgba(247, 239, 228, 0.12)",
    borderRadius: 8,
    background: "rgba(7, 8, 9, 0.42)",
  },
  loginLabel: {
    display: "grid",
    gap: 7,
    color: "#d8b36d",
    fontSize: 12,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 42,
    border: "1px solid rgba(247, 239, 228, 0.16)",
    borderRadius: 8,
    background: "rgba(17, 21, 23, 0.82)",
    color: "#f7efe4",
    padding: "0 12px",
    outline: "none",
  },
  smallButton: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 8,
    background: "rgba(216, 179, 109, 0.16)",
    color: "#f7efe4",
    fontWeight: 900,
  },
  errorText: {
    margin: "0 0 16px",
    color: "#ff8b82",
    fontWeight: 800,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    minHeight: 92,
    padding: 16,
    border: "1px solid rgba(247, 239, 228, 0.12)",
    borderRadius: 8,
    background: "rgba(17, 21, 23, 0.78)",
  },
  statLabel: {
    display: "block",
    marginBottom: 12,
    color: "#b9c6c6",
    fontSize: 13,
    fontWeight: 800,
  },
  statValue: {
    fontSize: 34,
    lineHeight: 1,
  },
  listHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
  },
  updatedText: {
    color: "#b9c6c6",
    fontSize: 13,
  },
  jobList: {
    display: "grid",
    gap: 10,
  },
  emptyState: {
    padding: 24,
    border: "1px solid rgba(247, 239, 228, 0.12)",
    borderRadius: 8,
    background: "rgba(17, 21, 23, 0.72)",
    color: "#b9c6c6",
    textAlign: "center",
  },
  jobCard: {
    padding: 16,
    border: "1px solid rgba(247, 239, 228, 0.12)",
    borderRadius: 8,
    background: "rgba(17, 21, 23, 0.78)",
  },
  jobTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  jobId: {
    margin: "0 0 6px",
    color: "#b9c6c6",
    fontFamily: "monospace",
    fontSize: 12,
  },
  jobTitle: {
    margin: 0,
    fontSize: 18,
  },
  statusBadge: {
    display: "inline-grid",
    placeItems: "center",
    minHeight: 30,
    padding: "0 10px",
    border: "1px solid",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    margin: "0 0 12px",
  },
  metaItem: {
    minWidth: 0,
  },
  jobMessage: {
    margin: 0,
    color: "#d9e2e1",
    lineHeight: 1.6,
    fontSize: 14,
  },
  jobError: {
    margin: "10px 0 0",
    padding: 10,
    borderRadius: 8,
    background: "rgba(255, 107, 98, 0.12)",
    color: "#ffaaa4",
    fontSize: 13,
    lineHeight: 1.55,
    overflowWrap: "anywhere",
  },
};
