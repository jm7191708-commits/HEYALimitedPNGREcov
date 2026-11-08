// Simple stub views - kept lightweight so the recruitment flow stays focused
const OFFER_REPORT_STATUSES = [
  { id: "pending", label: "Pending", cls: "stage-offer" },
  { id: "closed", label: "Closed", cls: "stage-hired" },
  { id: "rejected", label: "Rejected", cls: "stage-rejected" },
  { id: "deleted", label: "Deleted", cls: "stage-new" }
];

function getOfferMeta(status) {
  return OFFER_REPORT_STATUSES.find((item) => item.id === status) || {
    id: status || "pending",
    label: status || "Pending",
    cls: "stage-offer"
  };
}

function trackedOfferEntries(applicants) {
  return (applicants || []).filter((applicant) => Boolean(applicant?.offerStatus));
}

function OffersView({ applicants, positions, activePositionId, setActivePositionId, setView, onUpdateOfferStatus, onDeleteOffers }) {
  const [posFilter, setPosFilter] = React.useState("all");
  const [openMenuId, setOpenMenuId] = React.useState("");
  const [feedback, setFeedback] = React.useState(null);
  const [busyGroupId, setBusyGroupId] = React.useState("");
  const posMap = React.useMemo(
    () => Object.fromEntries((positions || []).map((position) => [String(position.id), position])),
    [positions]
  );
  const offers = React.useMemo(() => {
    const grouped = new Map();

    (applicants || []).forEach((applicant) => {
      if (applicant.offerStatus !== "pending") return;
      if (posFilter !== "all" && String(applicant.positionId || "") !== posFilter) return;

      const groupKey = String(applicant.positionId || applicant.id);
      const position = posMap[String(applicant.positionId)] || null;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          id: groupKey,
          positionId: String(applicant.positionId || ""),
          positionTitle: position?.title || applicant.positionTitle || "Untitled position",
          companyName: applicant.companyName || position?.client || "",
          applicants: [],
          updatedAt: applicant.offerStatusUpdatedAt || applicant.updatedAt || applicant.appliedAt || "",
          createdAt: applicant.appliedAt || ""
        });
      }

      const group = grouped.get(groupKey);
      group.applicants.push(applicant);
      const candidateTimestamp = applicant.offerStatusUpdatedAt || applicant.updatedAt || applicant.appliedAt || "";
      if (candidateTimestamp > group.updatedAt) {
        group.updatedAt = candidateTimestamp;
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        applicants: [...group.applicants].sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
        emails: [...new Set(group.applicants.map((applicant) => String(applicant.email || "").trim()).filter(Boolean))]
      }))
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
  }, [applicants, posFilter, posMap]);
  const selectedPosition = posFilter !== "all" ? posMap[posFilter] || null : null;

  React.useEffect(() => {
    const nextPositionId = activePositionId == null ? "" : String(activePositionId);
    if (!nextPositionId || !posMap[nextPositionId]) {
      setPosFilter("all");
      return;
    }
    setPosFilter(nextPositionId);
  }, [activePositionId, posMap]);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  React.useEffect(() => {
    if (!openMenuId) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenuId("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openMenuId]);

  function handlePositionFilterChange(nextValue) {
    setPosFilter(nextValue);
    if (setActivePositionId) {
      setActivePositionId(nextValue === "all" ? null : nextValue);
    }
  }

  function flash(message, tone = "success") {
    setFeedback({ message, tone });
  }

  function openGroupEmail(group) {
    const emails = group.emails || [];
    if (!emails.length) {
      flash("No saved email address is available for this offer group.", "error");
      return;
    }

    const to = encodeURIComponent(emails[0]);
    const bcc = emails.length > 1 ? `&bcc=${encodeURIComponent(emails.slice(1).join(","))}` : "";
    const subject = encodeURIComponent(`HEYA Talent Solutions offer follow-up - ${group.positionTitle}`);
    window.location.href = `mailto:${to}?subject=${subject}${bcc}`;
    flash(
      emails.length > 1
        ? `Opened one email draft for ${emails.length} candidates in this group.`
        : `Opened one email draft for ${group.applicants[0]?.name || "this candidate"}.`
    );
  }

  async function handleGroupStatusChange(group, status) {
    if (!onUpdateOfferStatus) return;
    setBusyGroupId(group.id);
    setOpenMenuId("");
    try {
      await onUpdateOfferStatus(group.applicants.map((applicant) => applicant.id), status);
      flash(
        status === "closed"
          ? "Offer group marked closed and moved to Reports history."
          : "Offer group updated."
      );
    } catch (error) {
      flash(error.message || "Unable to update this offer group right now.", "error");
    } finally {
      setBusyGroupId("");
    }
  }

  async function handleGroupDelete(group) {
    if (!onDeleteOffers) return;
    setBusyGroupId(group.id);
    setOpenMenuId("");
    try {
      await onDeleteOffers(group.applicants.map((applicant) => applicant.id));
      flash("Offer group soft-deleted and moved to Reports history.");
    } catch (error) {
      flash(error.message || "Unable to delete this offer group right now.", "error");
    } finally {
      setBusyGroupId("");
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono eyebrow">Offers</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Offers <em>pending action</em></h1>
          <div className="page-sub">Only pending offers stay here. Closed, rejected, and deleted offers move straight into Reports history.</div>
          <div className="cluster" style={{ marginTop: 10, gap: 8 }}>
            <span className="status-badge status-ready">Under Positions</span>
            <button className="btn ghost sm" onClick={() => {
              if (setActivePositionId) setActivePositionId(selectedPosition?.id || null);
              if (setView) setView("positions");
            }}>
              Back to Positions
            </button>
          </div>
        </div>
      </div>

      <div className="filter-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <select className="ifield" style={{ width: 240 }} value={posFilter} onChange={(event) => handlePositionFilterChange(event.target.value)}>
          <option value="all">All positions</option>
          {(positions || []).map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}
        </select>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        {offers.length === 0 && (
          <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
            No pending offers are visible for this filter.
          </div>
        )}

        {offers.map((group) => {
          const isBusy = busyGroupId === group.id;
          return (
            <div key={group.id} className="card offer-group-card">
              <div className="offer-group-card__main">
                <div className="offer-group-card__header">
                  <div>
                    <div className="offer-group-card__title">{group.positionTitle}</div>
                    <div className="offer-group-card__meta">
                      {group.companyName || "HEYA Talent Solutions"} · {group.applicants.length} candidate{group.applicants.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span className={"status-pill " + getOfferMeta("pending").cls}>{getOfferMeta("pending").label}</span>
                </div>

                <div className="offer-group-card__list">
                  {group.applicants.map((applicant) => (
                    <div key={applicant.id} className="offer-group-card__candidate">
                      <div>
                        <div className="offer-group-card__candidate-name">{applicant.name}</div>
                        <div className="offer-group-card__candidate-meta">
                          {applicant.email || "No email saved"} · stage {applicant.status}
                        </div>
                      </div>
                      <div className="offer-group-card__candidate-date">
                        {applicant.offerStatusUpdatedAt || applicant.updatedAt || applicant.appliedAt || ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="offer-group-card__actions">
                <button
                  className="btn ghost sm applicant-menu-trigger"
                  type="button"
                  onClick={() => openGroupEmail(group)}
                  disabled={isBusy}
                  aria-label={`Email candidates for ${group.positionTitle}`}
                  title="Email candidates"
                >
                  <I.Mail />
                </button>
                <div className="row-actions">
                  <button
                    className="btn ghost sm applicant-menu-trigger"
                    type="button"
                    onClick={() => setOpenMenuId((current) => current === group.id ? "" : group.id)}
                    disabled={isBusy}
                    aria-expanded={openMenuId === group.id}
                    aria-label={`More actions for ${group.positionTitle}`}
                  >
                    <I.Dots />
                  </button>
                  {openMenuId === group.id && (
                    <>
                      <div className="menu-scrim" onClick={() => setOpenMenuId("")} />
                      <div className="menu">
                        <button className="menu-item" type="button" onClick={() => handleGroupStatusChange(group, "closed")}>Mark Closed</button>
                        <div className="menu-sep"></div>
                        <button className="menu-item danger" type="button" onClick={() => handleGroupDelete(group)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {feedback && (
        <div className={"toast " + (feedback.tone === "error" ? "is-error" : "is-success")}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}

/* ── Report colour map ──────────────────────────────────────────────── */
const RPT_COLORS = {
  positions: { draft: "#94a3b8", ready: "#f59e0b", published: "#22c55e", closed: "#6b7280", screening: "#3b82f6" },
  stages: {
    applied: "#3b82f6", screening: "#8b5cf6", screened: "#06b6d4",
    shortlist_eligible: "#f59e0b", shortlisted: "#D4AF55",
    interview: "#f97316", final_review: "#ec4899",
    offer: "#0a1e3d", hired: "#22c55e",
    not_shortlisted: "#94a3b8", rejected: "#ef4444", closed: "#6b7280"
  },
  offers: { pending: "#f59e0b", closed: "#22c55e", rejected: "#ef4444", deleted: "#94a3b8" }
};


function csvEscapeCell(v) {
  const s = String(v == null ? "" : v).replace(/\r?\n/g, " ");
  return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsvBlob(headers, rows) {
  const lines = [headers.join(","), ...rows.map((r) => r.map(csvEscapeCell).join(","))];
  return new Blob([lines.join("\n")], { type: "text/csv" });
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STAT_META = {
  positions:  { icon: "fa-solid fa-layer-group",    iconBg: "#e8eef7", iconColor: "#0a1e3d", bar: "#0a1e3d" },
  published:  { icon: "fa-solid fa-circle-check",   iconBg: "#dcfce7", iconColor: "#16a34a", bar: "#16a34a" },
  applicants: { icon: "fa-solid fa-users",           iconBg: "#dbeafe", iconColor: "#2563eb", bar: "#2563eb" },
  offers:     { icon: "fa-solid fa-envelope-open",   iconBg: "#fef3c7", iconColor: "#b45309", bar: "#D4AF55" },
  hired:      { icon: "fa-solid fa-trophy",          iconBg: "#ccfbf1", iconColor: "#0d9488", bar: "#0d9488" },
  duplicates: { icon: "fa-solid fa-triangle-exclamation", iconBg: "#fff7ed", iconColor: "#c2410c", bar: "#c2410c" },
};

/* ── Mini bar used inside analysis results ──────────────────────────── */
function MiniBar({ pct, color }) {
  return (
    <div className="analysis-mini-bar-track">
      <div className="analysis-mini-bar-fill" style={{ width: pct + "%", background: color || "var(--primary)" }}></div>
    </div>
  );
}

/* ── Renders the result payload for any analysis type ───────────────── */
function AnalysisResult({ result }) {
  if (!result) return null;
  const { type } = result;

  return (
    <div className="report-analysis-result">
      <div className="report-analysis-summary">
        <i className="fa-solid fa-circle-info" style={{ color: "var(--muted)", marginRight: 6 }}></i>
        {result.summary}
      </div>

      {/* ── FUNNEL ── */}
      {type === "funnel" && (
        <div className="analysis-table-wrap">
          {result.activeRows.length > 0 && (
            <>
              <div className="analysis-section-label">Active pipeline</div>
              <table className="analysis-table">
                <thead><tr><th>Stage</th><th>Applicants</th><th>Share</th><th></th></tr></thead>
                <tbody>
                  {result.activeRows.map((r) => (
                    <tr key={r.stage}>
                      <td><span className="analysis-stage-dot" style={{ background: "#2563eb" }}></span>{r.label}</td>
                      <td className="analysis-num">{r.count}</td>
                      <td className="analysis-pct">{r.pct}%</td>
                      <td style={{ width: 120 }}><MiniBar pct={r.pct} color="#2563eb" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {result.exitedRows.length > 0 && (
            <>
              <div className="analysis-section-label" style={{ marginTop: 14 }}>Exited pipeline</div>
              <table className="analysis-table">
                <tbody>
                  {result.exitedRows.map((r) => (
                    <tr key={r.stage}>
                      <td><span className="analysis-stage-dot" style={{ background: "#94a3b8" }}></span>{r.label}</td>
                      <td className="analysis-num">{r.count}</td>
                      <td className="analysis-pct">{r.pct}%</td>
                      <td style={{ width: 120 }}><MiniBar pct={r.pct} color="#94a3b8" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── TOP POSITIONS ── */}
      {type === "positions" && (
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead><tr><th>#</th><th>Position</th><th>Status</th><th>Applicants</th><th>Offered</th><th>Hired</th></tr></thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={r.positionId}>
                  <td className="analysis-rank">{i + 1}</td>
                  <td><span className="analysis-pos-title">{r.title}</span></td>
                  <td><span className={"status-badge status-" + (r.status || "draft")}>{r.status || "—"}</span></td>
                  <td className="analysis-num">{r.total}</td>
                  <td className="analysis-num" style={{ color: r.offered > 0 ? "#D4AF55" : "var(--muted)" }}>{r.offered}</td>
                  <td className="analysis-num" style={{ color: r.hired > 0 ? "#16a34a" : "var(--muted)" }}>{r.hired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SCORES ── */}
      {type === "scores" && result.hasData && (
        <div className="analysis-scores-wrap">
          <div className="analysis-score-kpis">
            <div className="analysis-score-kpi"><span className="analysis-score-kpi__val">{result.avg}</span><span className="analysis-score-kpi__lbl">Average</span></div>
            <div className="analysis-score-kpi" style={{ color: "#16a34a" }}><span className="analysis-score-kpi__val">{result.max}</span><span className="analysis-score-kpi__lbl">Highest</span></div>
            <div className="analysis-score-kpi" style={{ color: "#ef4444" }}><span className="analysis-score-kpi__val">{result.min}</span><span className="analysis-score-kpi__lbl">Lowest</span></div>
            <div className="analysis-score-kpi"><span className="analysis-score-kpi__val">{result.total}</span><span className="analysis-score-kpi__lbl">Scored</span></div>
          </div>
          <div className="analysis-section-label" style={{ marginTop: 14 }}>Score distribution</div>
          <table className="analysis-table">
            <tbody>
              {result.buckets.map((b) => (
                <tr key={b.label}>
                  <td style={{ width: 90 }}>{b.label}</td>
                  <td className="analysis-num">{b.count}</td>
                  <td><MiniBar pct={result.total > 0 ? Math.round((b.count / result.total) * 100) : 0} color="#D4AF55" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="analysis-section-label" style={{ marginTop: 14 }}>Top 5 scorers</div>
          <table className="analysis-table">
            <thead><tr><th>Name</th><th>Position</th><th>Stage</th><th>Score</th></tr></thead>
            <tbody>
              {result.topScorers.map((s, i) => (
                <tr key={i}>
                  <td><strong>{s.name}</strong></td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{s.position}</td>
                  <td><span className={"status-pill stage-" + s.status}>{s.status}</span></td>
                  <td><span className="analysis-score-badge">{s.score}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {type === "scores" && !result.hasData && (
        <div className="analysis-empty">No screening scores have been recorded yet.</div>
      )}

      {/* ── OFFERS ── */}
      {type === "offers" && (
        <div className="analysis-offers-wrap">
          <div className="analysis-score-kpis">
            <div className="analysis-score-kpi" style={{ color: "#2563eb" }}><span className="analysis-score-kpi__val">{result.total}</span><span className="analysis-score-kpi__lbl">Total apps</span></div>
            <div className="analysis-score-kpi" style={{ color: "#D4AF55" }}><span className="analysis-score-kpi__val">{result.withOffer}</span><span className="analysis-score-kpi__lbl">Reached offer</span></div>
            <div className="analysis-score-kpi" style={{ color: "#16a34a" }}><span className="analysis-score-kpi__val">{result.hired}</span><span className="analysis-score-kpi__lbl">Hired</span></div>
          </div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Application → Offer rate", val: result.offerRate + "%", pct: result.offerRate, color: "#D4AF55" },
              { label: "Offer → Hire rate",         val: result.hireRate + "%",  pct: result.hireRate,  color: "#16a34a" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 200, fontSize: 13, color: "var(--muted)" }}>{row.label}</span>
                <MiniBar pct={row.pct} color={row.color} />
                <span style={{ width: 46, textAlign: "right", fontWeight: 700, fontSize: 14 }}>{row.val}</span>
              </div>
            ))}
            <div className="analysis-table-wrap" style={{ marginTop: 8 }}>
              <table className="analysis-table">
                <tbody>
                  <tr><td>Pending offers</td><td className="analysis-num" style={{ color: "#f59e0b" }}>{result.pendingOff}</td></tr>
                  <tr><td>Closed offers</td><td className="analysis-num" style={{ color: "#16a34a" }}>{result.closedOff}</td></tr>
                  <tr><td>Rejected offers</td><td className="analysis-num" style={{ color: "#ef4444" }}>{result.rejectedOff}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS ── */}
      {type === "documents" && (
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead><tr><th>Document check</th><th>Count</th><th>%</th><th></th></tr></thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="analysis-num">{r.count}</td>
                  <td className="analysis-pct">{r.pct}%</td>
                  <td style={{ width: 120 }}><MiniBar pct={r.pct} color="#7c3aed" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>Based on {result.total} total applicant{result.total !== 1 ? "s" : ""}.</div>
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {type === "activity" && (
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead><tr><th>Period</th><th>Applications</th><th></th></tr></thead>
            <tbody>
              {result.bands.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td className="analysis-num">{b.count}</td>
                  <td><MiniBar pct={result.total > 0 ? Math.round((b.count / result.total) * 100) : 0} color="#b45309" /></td>
                </tr>
              ))}
              {result.undated > 0 && (
                <tr>
                  <td style={{ color: "var(--muted)" }}>No date recorded</td>
                  <td className="analysis-num" style={{ color: "var(--muted)" }}>{result.undated}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportsView({ positions, applicants }) {
  /* ── derived data (memoised so chart effect deps stay stable) ──────── */
  const byStatus = React.useMemo(() =>
    Object.entries(window.STATUS_META).map(([key, meta]) => ({
      key, label: meta.label, cls: meta.cls,
      count: (positions || []).filter((p) => p.status === key).length
    })), [positions]);
  const byStage = React.useMemo(() =>
    (window.APPLICANT_STATUSES || []).map((s) => ({
      ...s, count: (applicants || []).filter((a) => a.status === s.id).length
    })), [applicants]);
  const offerRows = React.useMemo(() =>
    trackedOfferEntries(applicants).sort((l, r) =>
      String(r.offerStatusUpdatedAt || r.updatedAt || "").localeCompare(String(l.offerStatusUpdatedAt || l.updatedAt || ""))
    ), [applicants]);
  const offerSummary = React.useMemo(() =>
    OFFER_REPORT_STATUSES.map((s) => ({ ...s, count: offerRows.filter((a) => a.offerStatus === s.id).length })),
    [offerRows]);
  const positionMap = React.useMemo(
    () => Object.fromEntries((positions || []).map((p) => [String(p.id), p])), [positions]);

  /* ── KPIs ─────────────────────────────────────────────────────────── */
  const totalPositions   = (positions || []).length;
  const activePositions  = (positions || []).filter((p) => p.status === "published").length;
  const totalApplicants  = (applicants || []).length;
  const hiredCount       = (applicants || []).filter((a) => a.status === "hired").length;
  const pendingOffers    = (applicants || []).filter((a) => a.offerStatus === "pending").length;

  /* ── tab + UI state ───────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = React.useState("overview");
  const [csvOpen, setCsvOpen]     = React.useState(false);

  /* ── metrics state (Item 10) ──────────────────────────────────────── */
  const [metrics, setMetrics]               = React.useState(null);
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [metricsError, setMetricsError]     = React.useState("");
  const [duplicateCount, setDuplicateCount] = React.useState(null);

  /* load duplicate count once on mount */
  React.useEffect(() => {
    window.HEYA_API.getDuplicateSummary()
      .then((resp) => setDuplicateCount(resp.duplicateEmailCount || 0))
      .catch(() => {});
  }, []);

  /* ── chart refs ───────────────────────────────────────────────────── */
  const posCanvasRef   = React.useRef(null);
  const stageCanvasRef = React.useRef(null);
  const offerCanvasRef = React.useRef(null);
  const posChartInst   = React.useRef(null);
  const stageChartInst = React.useRef(null);
  const offerChartInst = React.useRef(null);

  /* ── analysis state — one result slot per card key ───────────────── */
  const [analysisResults, setAnalysisResults] = React.useState({});
  const [analysisLoading, setAnalysisLoading] = React.useState({});
  const [analysisErrors,  setAnalysisErrors]  = React.useState({});

  /* ── init / destroy charts ────────────────────────────────────────── */
  function destroyCharts() {
    [posChartInst, stageChartInst, offerChartInst].forEach((r) => { if (r.current) { r.current.destroy(); r.current = null; } });
  }

  function initCharts() {
    if (!window.Chart) return;
    const chartDefaults = { responsive: true, maintainAspectRatio: false, animation: { duration: 700, easing: "easeInOutQuart" } };
    const gridColor = "rgba(0,0,0,0.06)";
    const fontColor = "#64748b";

    /* positions bar (horizontal) */
    if (posCanvasRef.current) {
      if (posChartInst.current) posChartInst.current.destroy();
      const nonZero = byStatus.filter((s) => s.count > 0);
      const all     = nonZero.length > 0 ? nonZero : byStatus;
      posChartInst.current = new window.Chart(posCanvasRef.current, {
        type: "bar",
        data: {
          labels: all.map((s) => s.label),
          datasets: [{
            data: all.map((s) => s.count),
            backgroundColor: all.map((s) => RPT_COLORS.positions[s.key] || "#94a3b8"),
            borderRadius: 6, borderSkipped: false
          }]
        },
        options: {
          ...chartDefaults,
          indexAxis: "y",
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x} position${ctx.parsed.x !== 1 ? "s" : ""}` } } },
          scales: {
            x: { beginAtZero: true, ticks: { stepSize: 1, color: fontColor }, grid: { color: gridColor } },
            y: { ticks: { color: fontColor }, grid: { display: false } }
          }
        }
      });
    }

    /* stage bar (horizontal) */
    if (stageCanvasRef.current) {
      if (stageChartInst.current) stageChartInst.current.destroy();
      const active = byStage.filter((s) => s.count > 0);
      const rows   = active.length > 0 ? active : byStage.slice(0, 6);
      stageChartInst.current = new window.Chart(stageCanvasRef.current, {
        type: "bar",
        data: {
          labels: rows.map((s) => s.label),
          datasets: [{
            data: rows.map((s) => s.count),
            backgroundColor: rows.map((s) => RPT_COLORS.stages[s.id] || "#94a3b8"),
            borderRadius: 6, borderSkipped: false
          }]
        },
        options: {
          ...chartDefaults,
          indexAxis: "y",
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x} applicant${ctx.parsed.x !== 1 ? "s" : ""}` } } },
          scales: {
            x: { beginAtZero: true, ticks: { stepSize: 1, color: fontColor }, grid: { color: gridColor } },
            y: { ticks: { color: fontColor, font: { size: 11 } }, grid: { display: false } }
          }
        }
      });
    }

    /* offer donut */
    if (offerCanvasRef.current) {
      if (offerChartInst.current) offerChartInst.current.destroy();
      const hasOffers = offerSummary.some((s) => s.count > 0);
      offerChartInst.current = new window.Chart(offerCanvasRef.current, {
        type: "doughnut",
        data: {
          labels: offerSummary.map((s) => s.label),
          datasets: [{
            data: hasOffers ? offerSummary.map((s) => s.count) : [1],
            backgroundColor: hasOffers
              ? offerSummary.map((s) => RPT_COLORS.offers[s.id] || "#94a3b8")
              : ["#f1f5f9"],
            borderWidth: hasOffers ? 2 : 0,
            borderColor: "#fff",
            hoverOffset: 6
          }]
        },
        options: {
          ...chartDefaults,
          cutout: "68%",
          plugins: {
            legend: { position: "bottom", labels: { color: fontColor, padding: 12, boxWidth: 12, font: { size: 12 } } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}` } }
          }
        }
      });
    }
  }

  React.useEffect(() => {
    if (activeTab !== "overview") return undefined;
    const timer = window.setTimeout(initCharts, 60);
    return () => { window.clearTimeout(timer); destroyCharts(); };
  }, [activeTab, byStatus, byStage, offerSummary]); // all three are useMemo'd — safe

  /* ── load metrics when metrics tab is first opened ───────────────── */
  React.useEffect(() => {
    if (activeTab !== "metrics" || metrics !== null || metricsLoading) return;
    setMetricsLoading(true);
    setMetricsError("");
    window.HEYA_API.getReportingMetrics()
      .then((resp) => { setMetrics(resp.metrics || null); setMetricsLoading(false); })
      .catch((err) => { setMetricsError(err.message || "Failed to load metrics."); setMetricsLoading(false); });
  }, [activeTab, metrics, metricsLoading]);

  /* ── run a single pre-built analysis ─────────────────────────────── */
  async function runAnalysis(type) {
    setAnalysisLoading((prev) => ({ ...prev, [type]: true }));
    setAnalysisErrors((prev) => ({ ...prev, [type]: null }));
    try {
      const result = await window.HEYA_API.runAnalysis(type);
      setAnalysisResults((prev) => ({ ...prev, [type]: result }));
    } catch (err) {
      setAnalysisErrors((prev) => ({ ...prev, [type]: err.message || "Analysis failed." }));
    } finally {
      setAnalysisLoading((prev) => ({ ...prev, [type]: false }));
    }
  }

  /* ── CSV download ─────────────────────────────────────────────────── */
  function downloadCSV(type) {
    window.open(`/api/admin/reports/csv?type=${encodeURIComponent(type)}`, "_blank");
    setCsvOpen(false);
  }

  /* ── render ───────────────────────────────────────────────────────── */
  return (
    <div className="page">
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <div className="mono eyebrow">Reports</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Hiring <em>health</em></h1>
          <div className="page-sub">Live snapshot of your recruitment pipeline — charts, data analysis, and raw exports.</div>
        </div>

        {/* Download button */}
        <div style={{ position: "relative" }}>
          <button className="btn accent" onClick={() => setCsvOpen((v) => !v)}>
            <i className="fa-solid fa-download" style={{ marginRight: 6 }}></i>
            Download Report
          </button>
          {csvOpen && (
            <>
              <div className="menu-scrim" onClick={() => setCsvOpen(false)} />
              <div className="menu" style={{ right: 0, top: "calc(100% + 6px)", minWidth: 200 }}>
                <div className="menu-item" style={{ fontWeight: 700, color: "var(--muted)", cursor: "default", fontSize: 11 }}>Choose dataset</div>
                <div className="menu-sep" />
                <button className="menu-item" type="button" onClick={() => downloadCSV("applicants")}>
                  <i className="fa-solid fa-users" style={{ marginRight: 8, color: "#3b82f6" }}></i> Applicants CSV
                </button>
                <button className="menu-item" type="button" onClick={() => downloadCSV("positions")}>
                  <i className="fa-solid fa-briefcase" style={{ marginRight: 8, color: "#22c55e" }}></i> Positions CSV
                </button>
                <button className="menu-item" type="button" onClick={() => downloadCSV("offers")}>
                  <i className="fa-solid fa-envelope-open-text" style={{ marginRight: 8, color: "#D4AF55" }}></i> Offers CSV
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI stat strip */}
      <div className="report-stat-strip">
        {[
          { key: "positions",  label: "Total Positions",   value: totalPositions  },
          { key: "published",  label: "Published",         value: activePositions },
          { key: "applicants", label: "Total Applicants",  value: totalApplicants },
          { key: "offers",     label: "Pending Offers",    value: pendingOffers   },
          { key: "hired",      label: "Hired",             value: hiredCount      },
          { key: "duplicates", label: "Repeat Applicants",  value: duplicateCount ?? "—" },
        ].map((stat, idx, arr) => {
          const m = STAT_META[stat.key];
          return (
            <React.Fragment key={stat.key}>
              <div className="report-stat-item">
                <div className="report-stat-top">
                  <span className="report-stat-label">{stat.label}</span>
                  <span className="report-stat-icon" style={{ background: m.iconBg }}>
                    <i className={m.icon} style={{ color: m.iconColor }}></i>
                  </span>
                </div>
                <div className="report-stat-value" style={{ color: m.bar }}>{stat.value}</div>
                <div className="report-stat-bar" style={{ background: m.bar }}></div>
              </div>
              {idx < arr.length - 1 && <div className="report-stat-divider" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="report-tab-bar">
        <button className={"report-tab" + (activeTab === "overview" ? " is-active" : "")} onClick={() => setActiveTab("overview")}>
          <i className="fa-solid fa-chart-bar" style={{ marginRight: 6 }}></i>Overview
        </button>
        <button
          className={"report-tab" + (activeTab === "metrics" ? " is-active" : "")}
          onClick={() => setActiveTab("metrics")}
        >
          <i className="fa-solid fa-gauge-high" style={{ marginRight: 6 }}></i>Metrics
        </button>
        <button
          className={"report-tab" + (activeTab === "analysis" ? " is-active" : "")}
          onClick={() => setActiveTab("analysis")}
        >
          <i className="fa-solid fa-magnifying-glass-chart" style={{ marginRight: 6 }}></i>Analysis
        </button>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <>
          <div className="grid cols-2">
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Positions by status</div>
              <div style={{ height: 200, position: "relative" }}>
                <canvas ref={posCanvasRef}></canvas>
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Applicants by stage</div>
              <div style={{ height: 200, position: "relative" }}>
                <canvas ref={stageCanvasRef}></canvas>
              </div>
            </div>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div className="card-title" style={{ marginBottom: 14, alignSelf: "flex-start" }}>Offer status</div>
              <div style={{ height: 230, width: "100%", position: "relative" }}>
                <canvas ref={offerCanvasRef}></canvas>
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 10 }}>Offer history</div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
                Closed, rejected, and deleted offers — from saved database records.
              </div>
              <div className="stack" style={{ gap: 10, maxHeight: 380, overflow: "auto", paddingRight: 4 }}>
                {offerRows.length === 0 && <div style={{ color: "var(--muted)" }}>No tracked offer history yet.</div>}
                {offerRows.map((applicant) => {
                  const offerMeta = getOfferMeta(applicant.offerStatus);
                  const position  = positionMap[String(applicant.positionId)] || null;
                  return (
                    <div key={applicant.id} className="offer-history-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{applicant.name}</div>
                        <div className="offer-history-row__meta">
                          {position?.title || applicant.positionTitle || "Untitled"} · {applicant.email || "No email"}
                        </div>
                      </div>
                      <div className="offer-history-row__status">
                        <span className={"status-pill " + offerMeta.cls}>{offerMeta.label}</span>
                        <div className="offer-history-row__meta">
                          {applicant.offerStatusUpdatedAt || applicant.updatedAt || applicant.appliedAt || ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── METRICS TAB ── */}
      {activeTab === "metrics" && (
        <div className="metrics-tab">
          {metricsLoading && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22 }}></i>
              <div style={{ marginTop: 12, fontSize: 13 }}>Loading metrics…</div>
            </div>
          )}
          {metricsError && (
            <div className="card" style={{ padding: 20, color: "var(--danger)", fontSize: 13 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }}></i>{metricsError}
            </div>
          )}
          {metrics && !metricsLoading && (
            <>
              {/* Row 1: Time to hire + Offer acceptance */}
              <div className="grid cols-2" style={{ gap: 16 }}>
                <div className="card metrics-stat-card">
                  <div className="card-title" style={{ marginBottom: 14 }}>
                    <i className="fa-solid fa-clock" style={{ marginRight: 8, color: "#0a1e3d" }}></i>
                    Time to Hire
                  </div>
                  {metrics.timeToHire.avgDaysOverall === null ? (
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>No hires recorded yet.</div>
                  ) : (
                    <>
                      <div className="metrics-big-stat">{metrics.timeToHire.avgDaysOverall}<span style={{ fontSize: 16, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>avg days</span></div>
                      {metrics.timeToHire.perPosition.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div className="mono eyebrow" style={{ marginBottom: 8 }}>Per position</div>
                          <div className="stack" style={{ gap: 6 }}>
                            {metrics.timeToHire.perPosition.map((row, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                                <span style={{ color: "var(--ink-2)", flex: 1, marginRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.position_title}</span>
                                <span className="mono" style={{ color: "var(--muted)", flexShrink: 0 }}>{row.avg_days} days · {row.hired_count} hired</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="card metrics-stat-card">
                  <div className="card-title" style={{ marginBottom: 14 }}>
                    <i className="fa-solid fa-envelope-open-text" style={{ marginRight: 8, color: "#D4AF55" }}></i>
                    Offer Acceptance Rate
                  </div>
                  {metrics.offerAcceptance.total === 0 ? (
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>No offers on record yet.</div>
                  ) : (
                    <>
                      <div className="metrics-big-stat">
                        {metrics.offerAcceptance.rate !== null ? `${metrics.offerAcceptance.rate}%` : "—"}
                        <span style={{ fontSize: 16, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>acceptance</span>
                      </div>
                      <div className="metrics-offer-row-grid">
                        {[
                          { label: "Total offers", value: metrics.offerAcceptance.total,    color: "#0a1e3d" },
                          { label: "Accepted",      value: metrics.offerAcceptance.accepted, color: "#16a34a" },
                          { label: "Rejected",      value: metrics.offerAcceptance.rejected, color: "#dc2626" },
                          { label: "Pending",       value: metrics.offerAcceptance.pending,  color: "#d97706" },
                          { label: "Expired",       value: metrics.offerAcceptance.expired,  color: "#6b7280" },
                        ].map((item) => (
                          <div key={item.label} className="metrics-offer-row">
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.label}</span>
                            <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 2: Stage funnel */}
              <div className="card" style={{ marginTop: 16, padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>
                  <i className="fa-solid fa-filter" style={{ marginRight: 8, color: "#2563eb" }}></i>
                  Pipeline Funnel — Stage Conversion
                </div>
                <div className="metrics-funnel">
                  {metrics.stageFunnel.map((step, idx) => {
                    const FUNNEL_COLORS = { new: "#6c757d", screening: "#0a1e3d", shortlisted: "#0a7aff", interview: "#7c3aed", offer: "#D4AF55", hired: "#16a34a" };
                    const color = FUNNEL_COLORS[step.stage] || "#94a3b8";
                    const maxCount = Math.max(...metrics.stageFunnel.map((s) => s.count), 1);
                    const barPct = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0;
                    return (
                      <div key={step.stage} className="metrics-funnel-step">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize", color }}>{step.stage}</span>
                          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                            {step.count}
                            {step.conversionPct !== null && (
                              <span style={{ marginLeft: 8, color: step.conversionPct >= 50 ? "#16a34a" : "#dc2626" }}>
                                ↓ {step.conversionPct}%
                              </span>
                            )}
                          </span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${barPct}%`, background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Rejection reasons */}
              <div className="card" style={{ marginTop: 16, padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 14 }}>
                  <i className="fa-solid fa-ban" style={{ marginRight: 8, color: "#dc2626" }}></i>
                  Rejection Reason Breakdown
                </div>
                {metrics.rejectionBreakdown.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>No rejected applicants yet.</div>
                ) : (
                  <div className="stack" style={{ gap: 10 }}>
                    {(() => {
                      const maxCount = Math.max(...metrics.rejectionBreakdown.map((r) => r.count), 1);
                      return metrics.rejectionBreakdown.map((row, i) => (
                        <div key={i} className="metrics-rejection-row">
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{row.reason}</span>
                            <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{row.count}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.round((row.count / maxCount) * 100)}%`, background: "#dc2626", borderRadius: 3, opacity: 0.7 + (0.3 * (row.count / maxCount)) }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button className="btn ghost sm" onClick={() => { setMetrics(null); setMetricsLoading(false); }}>
                  <i className="fa-solid fa-rotate-right" style={{ marginRight: 6 }}></i>Refresh metrics
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ANALYSIS TAB ── */}
      {activeTab === "analysis" && (
        <div className="report-analysis-grid">
          {[
            {
              type: "funnel",
              icon: "fa-solid fa-filter",
              iconColor: "#2563eb",
              title: "Pipeline Funnel",
              description: "How many applicants sit at each recruitment stage right now, and what percentage of the total they represent.",
            },
            {
              type: "positions",
              icon: "fa-solid fa-briefcase",
              iconColor: "#0d9488",
              title: "Positions by Applicants",
              description: "Which open positions are receiving the most applications, including how many reached offer or hire stage.",
            },
            {
              type: "scores",
              icon: "fa-solid fa-star-half-stroke",
              iconColor: "#D4AF55",
              title: "Score Breakdown",
              description: "Average, highest and lowest screening scores across all applicants, plus the top 5 highest scorers.",
            },
            {
              type: "offers",
              icon: "fa-solid fa-envelope-open-text",
              iconColor: "#16a34a",
              title: "Offer Conversion",
              description: "What percentage of applicants reached the offer stage and how many ultimately converted to a hire.",
            },
            {
              type: "documents",
              icon: "fa-solid fa-file-lines",
              iconColor: "#7c3aed",
              title: "Document Completeness",
              description: "How many applicants submitted a CV, cover letter, or both — shows how complete the applicant pool is.",
            },
            {
              type: "activity",
              icon: "fa-solid fa-clock-rotate-left",
              iconColor: "#b45309",
              title: "Recent Activity",
              description: "Application volume grouped by how recently they were submitted — last 7, 14, 30 and 60 days.",
            },
          ].map((card) => {
            const result  = analysisResults[card.type];
            const loading = analysisLoading[card.type];
            const error   = analysisErrors[card.type];
            return (
              <div key={card.type} className={"report-analysis-card" + (result ? " has-result" : "")}>
                <div className="report-analysis-card__head">
                  <div className="report-analysis-card__icon" style={{ color: card.iconColor }}>
                    <i className={card.icon}></i>
                  </div>
                  <div className="report-analysis-card__meta">
                    <div className="report-analysis-card__title">{card.title}</div>
                    <div className="report-analysis-card__desc">{card.description}</div>
                  </div>
                  <button
                    className={"btn sm" + (result ? " ghost" : " accent")}
                    disabled={loading}
                    onClick={() => runAnalysis(card.type)}
                  >
                    {loading
                      ? <><i className="fa-solid fa-spinner fa-spin"></i> Running…</>
                      : result
                        ? <><i className="fa-solid fa-rotate-right"></i> Refresh</>
                        : <><i className="fa-solid fa-play"></i> Run</>
                    }
                  </button>
                </div>

                {error && (
                  <div className="report-analysis-error">
                    <i className="fa-solid fa-circle-exclamation"></i> {error}
                  </div>
                )}

                {result && <AnalysisResult result={result} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SETTINGS_CATEGORIES = [
  {
    id: "accounts",
    title: "Accounts",
    description: "Profile identity, personal defaults, density, and accent behavior."
  },
  {
    id: "plugins",
    title: "Plugins / Apps",
    description: "Marketplace-style app controls for dashboard extensions and growth tools."
  },
  {
    id: "mcp",
    title: "MCP Configurations",
    description: "Service connections, MCP access, endpoint setup, and permissions."
  }
];

const SETTINGS_PLUGIN_CATALOG = [
  {
    key: "aiAssistant",
    icon: "AI",
    iconImg: "/dashboard-assets/assets/roxanne-ai-logo.png",
    name: "AI Assistant",
    description: "Smart chat, workflow help, and drafting support across the dashboard.",
    tags: ["AI", "Automation"]
  },
  {
    key: "tweaksPanel",
    icon: "PB",
    iconImg: "https://upload.wikimedia.org/wikipedia/commons/c/cf/New_Power_BI_Logo.svg",
    name: "Power BI",
    description: "Microsoft Power BI integration — live dashboards, visual reports, and business intelligence across your hiring data.",
    tags: ["Microsoft", "Analytics"]
  },
  {
    key: "analyticsPro",
    icon: "GA",
    iconImg: "https://upload.wikimedia.org/wikipedia/commons/7/77/GAnalytics.svg",
    name: "Google Analytics",
    description: "Connect Google Analytics to track portal traffic, job listing views, and candidate conversion funnels.",
    tags: ["Google", "Analytics"]
  },
  {
    key: "customerCrm",
    icon: "CRM",
    iconImg: "https://play-lh.googleusercontent.com/XAKratCqSJUb3ZmItve16p8RjiF0ZvN_czysEoqtGET7i-tsdJEozbnOYRM6jQNHEg=w240-h480",
    name: "Pipedrive CRM",
    description: "Lead pipelines, customer notes, conversations, and account follow-up via Pipedrive.",
    tags: ["Sales", "Pipedrive"]
  },
  {
    key: "marketingFunnel",
    icon: "MY",
    iconImg: "https://www.darcyservices.com.au/wp-content/uploads/2015/09/myob.png",
    name: "MYOB",
    description: "MYOB accounting integration — sync payroll, invoices, and financial records directly with your workforce data.",
    tags: ["Accounting", "MYOB"]
  },
  {
    key: "jobBoardBooster",
    icon: "ZH",
    iconImg: "https://i.pinimg.com/736x/ad/d8/dc/add8dc1359dbece041e40456660101dc.jpg",
    name: "Zoho",
    description: "Zoho suite integration — recruit, CRM, campaigns, and workforce management in one connection.",
    tags: ["Zoho", "Distribution"]
  }
];

const ROXANNE_MCP_LABEL = "roxanneMCP server";
const ROXANNE_MCP_ICON = "/dashboard-assets/assets/roxanne-mcp-icon.png";

const SETTINGS_MCP_CONNECTION = {
  icon: ROXANNE_MCP_ICON,
  name: ROXANNE_MCP_LABEL,
  description: "Connect the dashboard once to Roxanne MCP. Use the switch as a temporary block when tools should pause without disconnecting the server."
};

function normalizeSettingsDraft(settings) {
  const safeSettings = settings || {};
  const accountSettings = safeSettings.accountSettings || {};
  const profile = safeSettings.profile || {};
  const preferences = safeSettings.preferences || accountSettings.displayPreferences || {};
  const mcp = safeSettings.mcp || {};
  const legacyApps = safeSettings.integrations?.apps || {};
  const legacyMcp = safeSettings.integrations?.mcpConfigurations || {};

  return {
    profile: {
      username: profile.username || "",
      displayName: profile.displayName || accountSettings.fullName || "",
      email: profile.email || accountSettings.email || "",
      avatarUrl: profile.avatarUrl || accountSettings.avatarUrl || ""
    },
    preferences: {
      defaultView: preferences.defaultView || "dashboard",
      density: preferences.density || "balanced",
      accent: preferences.accent || "orange"
    },
    plugins: {
      aiAssistant: Boolean(safeSettings.plugins?.aiAssistant),
      tweaksPanel: Boolean(safeSettings.plugins?.tweaksPanel),
      analyticsPro: Boolean(safeSettings.plugins?.analyticsPro),
      customerCrm: Boolean(safeSettings.plugins?.customerCrm),
      marketingFunnel: Boolean(safeSettings.plugins?.marketingFunnel),
      jobBoardBooster: Boolean(safeSettings.plugins?.jobBoardBooster)
    },
    mcp: {
      enabled: Boolean(mcp.enabled ?? legacyApps.facebook?.enabled ?? legacyApps.linkedin?.enabled ?? legacyApps.spacemail?.enabled),
      connected: Boolean(mcp.connected ?? legacyApps.facebook?.connected ?? legacyApps.linkedin?.connected ?? legacyApps.spacemail?.connected),
      serverLabel: ROXANNE_MCP_LABEL,
      proxyPath: mcp.proxyPath || "/api/mcp/proxy",
      facebookAuthPath: mcp.facebookAuthPath === "/facebook/connect" ? "/facebook/auth" : (mcp.facebookAuthPath || "/facebook/auth"),
      linkedinAuthPath: mcp.linkedinAuthPath || "/linkedin/auth",
      endpoint: mcp.endpoint || legacyMcp.endpoint || "",
      apiKey: mcp.apiKey || "",
      apiKeyConfigured: Boolean(mcp.apiKeyConfigured || mcp.apiKey),
      permissions: mcp.permissions || "read-only"
    }
  };
}

function SettingsView({ settings, onSaveSettings }) {
  const [activeLayer, setActiveLayer] = React.useState("accounts");
  const [draft, setDraft] = React.useState(() => normalizeSettingsDraft(settings));
  const [saving, setSaving] = React.useState(false);
  const [testingMcp, setTestingMcp] = React.useState(false);
  const [oauthBusyProvider, setOauthBusyProvider] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [messageTone, setMessageTone] = React.useState("muted");
  const [mcpTestResult, setMcpTestResult] = React.useState(null);

  // ── Pipedrive CRM state ────────────────────────────────────────────────────
  const [pdApiKeyConfigured, setPdApiKeyConfigured] = React.useState(false);
  const [pdTestResult, setPdTestResult] = React.useState(null);
  const [pdTesting, setPdTesting] = React.useState(false);
  const [pdSyncModal, setPdSyncModal] = React.useState(false);
  const [pdSyncing, setPdSyncing] = React.useState(false);
  const [pdSyncResult, setPdSyncResult] = React.useState(null);
  const [pdLastSyncAt, setPdLastSyncAt] = React.useState(null);

  // Load Pipedrive status whenever the plugins layer is shown
  React.useEffect(() => {
    if (activeLayer !== "plugins") return;
    window.HEYA_API.getPipedriveSettings()
      .then((data) => {
        setPdApiKeyConfigured(Boolean(data.apiKeyConfigured));
        setPdLastSyncAt(data.lastSyncAt || null);
        if (data.lastSyncResult) setPdSyncResult(data.lastSyncResult);
      })
      .catch(() => {});
  }, [activeLayer]);

  async function testPipedriveConnection() {
    setPdTesting(true);
    setPdTestResult(null);
    try {
      const data = await window.HEYA_API.testPipedriveConnection();
      setPdTestResult(data);
      if (data.ok) setPdApiKeyConfigured(true);
    } catch (err) {
      setPdTestResult({ ok: false, message: err.message || "Connection test failed." });
    } finally {
      setPdTesting(false);
    }
  }

  async function confirmPipedriveSync() {
    setPdSyncing(true);
    setPdSyncResult(null);
    try {
      const data = await window.HEYA_API.syncApplicantsToPipedrive();
      setPdSyncResult(data);
      setPdLastSyncAt(data.syncedAt || new Date().toISOString());
      setPdSyncModal(false);
    } catch (err) {
      setPdSyncResult({ ok: false, message: err.message || "Sync failed. Check that PIPEDRIVE_API_KEY is set on Render." });
      setPdSyncModal(false);
    } finally {
      setPdSyncing(false);
    }
  }

  React.useEffect(() => {
    setDraft(normalizeSettingsDraft(settings));
  }, [settings]);

  React.useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => {
      setMessage("");
      setMessageTone("muted");
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  React.useEffect(() => {
    const onMessage = (event) => {
      if (!event?.data || typeof event.data !== "object") return;
      if (event.data.type !== "heya:mcp-auth-complete") return;
      setOauthBusyProvider("");
      setMessage("OAuth flow completed. Re-checking MCP connection...");
      setMessageTone("muted");
      testMcpConnection();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function updateProfile(key, value) {
    setDraft((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [key]: value
      }
    }));
  }

  function updatePreferences(key, value) {
    setDraft((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value
      }
    }));
  }

  function updatePlugin(key, value) {
    setDraft((current) => ({
      ...current,
      plugins: {
        ...current.plugins,
        [key]: value
      }
    }));
  }

  function updateMcpField(key, value) {
    setDraft((current) => ({
      ...current,
      mcp: {
        ...current.mcp,
        [key]: value
      }
    }));
  }

  function connectMcpServer() {
    setDraft((current) => ({
      ...current,
      mcp: {
        ...current.mcp,
        serverLabel: ROXANNE_MCP_LABEL,
        enabled: true,
        connected: true
      }
    }));
    setMessage("roxanneMCP server is marked connected. Save changes to persist this configuration.");
    setMessageTone("muted");
  }

  function resetDraft() {
    setDraft(normalizeSettingsDraft(settings));
    setMessage("Draft restored to the current saved settings.");
    setMessageTone("muted");
    setMcpTestResult(null);
  }

  async function testMcpConnection() {
    setTestingMcp(true);
    setMcpTestResult(null);
    setMessage("");
    setMessageTone("muted");

    try {
      const response = await window.HEYA_API.testMcpConnection({
        path: "/healthz"
      });
      setMcpTestResult(response);
      setMessage(response.message || "MCP connection test completed.");
      setMessageTone(response.ok ? "success" : response.reauthRequired ? "muted" : "error");
    } catch (error) {
      setMcpTestResult(null);
      setMessage(error.message || "Unable to test the MCP connection.");
      setMessageTone("error");
    } finally {
      setTestingMcp(false);
    }
  }

  async function startMcpProviderOauth(provider) {
    setOauthBusyProvider(provider);
    try {
      const fallbackReturnTo = window.location.origin + window.location.pathname + "#settings-mcp";
      const response = await window.HEYA_API.startMcpOauth(provider, {
        returnTo: fallbackReturnTo,
        state: `heya-${provider}-${Date.now()}`
      });

      const width = 720;
      const height = 780;
      const left = Math.max(0, Math.round((window.screen.width - width) / 2));
      const top = Math.max(0, Math.round((window.screen.height - height) / 2));
      const popup = window.open(
        response.authUrl,
        `heya-mcp-${provider}`,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        setMessage(`Popup was blocked. Open the ${provider} reconnect flow manually.`);
        setMessageTone("error");
        setOauthBusyProvider("");
        return;
      }

      setMessage(`Complete the ${provider} authentication flow, then the dashboard will re-check the MCP connection.`);
      setMessageTone("muted");

      const poll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(poll);
          setOauthBusyProvider("");
          testMcpConnection();
        }
      }, 1200);
    } catch (error) {
      setMessage(error.message || `Unable to open the ${provider} reconnect flow.`);
      setMessageTone("error");
      setOauthBusyProvider("");
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!draft || !onSaveSettings) return;
    // capture the CRM state before saving so we can detect a fresh enable
    const crmWasOff = !Boolean(settings?.plugins?.customerCrm);
    const crmNowOn  = Boolean(draft.plugins?.customerCrm);
    setSaving(true);
    setMessage("");
    setMessageTone("muted");

    try {
      const payload = {
        accountSettings: {
          ...(settings?.accountSettings || {}),
          fullName: draft.profile.displayName,
          email: draft.profile.email,
          avatarUrl: draft.profile.avatarUrl,
          displayPreferences: {
            defaultView: draft.preferences.defaultView,
            density: draft.preferences.density,
            accent: draft.preferences.accent
          }
        },
        profile: draft.profile,
        preferences: draft.preferences,
        plugins: draft.plugins,
        mcp: {
          ...draft.mcp,
          serverLabel: ROXANNE_MCP_LABEL,
          proxyPath: draft.mcp.proxyPath || "/api/mcp/proxy",
          facebookAuthPath: draft.mcp.facebookAuthPath === "/facebook/connect" ? "/facebook/auth" : (draft.mcp.facebookAuthPath || "/facebook/auth"),
          linkedinAuthPath: draft.mcp.linkedinAuthPath || "/linkedin/auth"
        }
      };

      const savedSettings = await onSaveSettings(payload);
      setDraft(normalizeSettingsDraft(savedSettings || payload));
      setMessage("Settings saved successfully.");
      setMessageTone("success");

      // If Pipedrive CRM was just turned ON (previously OFF → now ON),
      // prompt the user to push existing applicants to Pipedrive.
      if (crmNowOn && crmWasOff) {
        setPdSyncModal(true);
      }
    } catch (error) {
      setMessage(error.message || "Unable to save settings right now.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 28 }}>Loading settings...</div>
      </div>
    );
  }

  const accountName = draft.profile.displayName || draft.profile.username || "Dashboard Admin";
  const avatarPreview = draft.profile.avatarUrl || "";
  const pluginEnabledCount = SETTINGS_PLUGIN_CATALOG.filter((plugin) => draft.plugins[plugin.key]).length;
  const mcpConnectedCount = draft.mcp.connected ? 1 : 0;
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(normalizeSettingsDraft(settings));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono eyebrow">Settings</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Settings <em>workspace</em></h1>
          <div className="page-sub">Choose a category, make your changes in place, and save everything through the existing dashboard settings API.</div>
        </div>
      </div>

      <form className="settings-shell" onSubmit={saveSettings}>
        <aside className="card settings-shell__menu">
          <div className="settings-shell__menu-head">
            <div className="mono eyebrow">Settings Areas</div>
            <div className="settings-shell__menu-title">Admin preferences</div>
            <div className="settings-shell__menu-copy">Manage account identity, dashboard apps, and MCP services without leaving the page.</div>
          </div>

          <div className="settings-category-list">
            {SETTINGS_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={"settings-category-btn" + (activeLayer === category.id ? " is-active" : "")}
                onClick={() => setActiveLayer(category.id)}
              >
                <strong>{category.title}</strong>
                <span>{category.description}</span>
              </button>
            ))}
          </div>

          <div className="settings-mini-summary">
            <div className="settings-mini-summary__row">
              <span className="mono eyebrow">Apps enabled</span>
              <strong>{pluginEnabledCount}</strong>
            </div>
            <div className="settings-mini-summary__row">
              <span className="mono eyebrow">MCP connected</span>
              <strong>{mcpConnectedCount}</strong>
            </div>
            <div className="settings-mini-summary__row">
              <span className="mono eyebrow">Dashboard default</span>
              <strong>{draft.preferences.defaultView}</strong>
            </div>
          </div>
        </aside>

        <section className="card settings-shell__content">
          {activeLayer === "accounts" && (
            <div className="settings-layer">
              <div className="settings-layer-head">
                <div>
                  <div className="mono eyebrow">Accounts</div>
                  <div className="settings-layer-title">Account configuration</div>
                  <p>Update profile identity, email, avatar presentation, and dashboard behavior defaults.</p>
                </div>
                <div className="settings-profile-preview card">
                  <div className="avatar tone-c settings-profile-preview__avatar">
                    {avatarPreview ? <img src={avatarPreview} alt={accountName} /> : initialsForSettings(accountName)}
                  </div>
                  <div>
                    <div className="settings-profile-preview__name">{accountName}</div>
                    <div className="settings-profile-preview__meta">@{draft.profile.username || "dashboard-admin"}</div>
                  </div>
                </div>
              </div>

              <div className="settings-form-grid">
                <label className="settings-field">
                  <span className="mono eyebrow">Username</span>
                  <input className="ifield" value={draft.profile.username} onChange={(event) => updateProfile("username", event.target.value)} />
                </label>
                <label className="settings-field">
                  <span className="mono eyebrow">Display name</span>
                  <input className="ifield" value={draft.profile.displayName} onChange={(event) => updateProfile("displayName", event.target.value)} />
                </label>
                <label className="settings-field">
                  <span className="mono eyebrow">Email</span>
                  <input className="ifield" type="email" value={draft.profile.email} onChange={(event) => updateProfile("email", event.target.value)} />
                </label>
                <label className="settings-field">
                  <span className="mono eyebrow">Avatar / profile image URL</span>
                  <input className="ifield" value={draft.profile.avatarUrl} onChange={(event) => updateProfile("avatarUrl", event.target.value)} placeholder="https://example.com/avatar.jpg" />
                </label>
              </div>

              <div className="grid cols-2 settings-detail-grid">
                <div className="card settings-subcard">
                  <div className="card-title">Display defaults</div>
                  <div className="settings-stack-fields">
                    <label className="settings-field">
                      <span className="mono eyebrow">Default dashboard view</span>
                      <select className="ifield" value={draft.preferences.defaultView} onChange={(event) => updatePreferences("defaultView", event.target.value)}>
                        <option value="dashboard">Dashboard</option>
                        <option value="positions">Positions</option>
                        <option value="applicants">Applicants</option>
                        <option value="requisitions">Requisitions</option>
                        <option value="settings">Settings</option>
                      </select>
                    </label>
                    <label className="settings-field">
                      <span className="mono eyebrow">Density</span>
                      <select className="ifield" value={draft.preferences.density} onChange={(event) => updatePreferences("density", event.target.value)}>
                        <option value="balanced">Balanced</option>
                        <option value="dense">Dense</option>
                      </select>
                    </label>
                    <label className="settings-field">
                      <span className="mono eyebrow">Accent theme</span>
                      <select className="ifield" value={draft.preferences.accent} onChange={(event) => updatePreferences("accent", event.target.value)}>
                        <option value="orange">Orange</option>
                        <option value="gold">Gold</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="card settings-subcard settings-account-card">
                  <div className="mono eyebrow">Profile Preview</div>
                  <div className="settings-account-card__hero">
                    <div className="avatar tone-d settings-account-card__avatar">
                      {avatarPreview ? <img src={avatarPreview} alt={accountName} /> : initialsForSettings(accountName)}
                    </div>
                    <div>
                      <div className="settings-account-card__name">{accountName}</div>
                      <div className="settings-account-card__line">{draft.profile.email || "No email set yet"}</div>
                    </div>
                  </div>
                  <div className="settings-account-card__meta">
                    <span className="tag orange">Default: {draft.preferences.defaultView}</span>
                    <span className="tag">{draft.preferences.density}</span>
                    <span className="tag gold">{draft.preferences.accent}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeLayer === "plugins" && (
            <div className="settings-layer">
              <div className="settings-layer-head">
                <div>
                  <div className="mono eyebrow">Plugins / Apps</div>
                  <div className="settings-layer-title">Marketplace controls</div>
                  <p>Enable, stage, and configure dashboard extensions from one polished app-store style panel.</p>
                </div>
                <div className="settings-layer-stat card">
                  <div className="mono eyebrow">Enabled apps</div>
                  <div className="settings-layer-stat__value">{pluginEnabledCount}</div>
                </div>
              </div>

              <div className="settings-market-grid">
                {SETTINGS_PLUGIN_CATALOG.map((plugin) => {
                  const isEnabled = Boolean(draft.plugins[plugin.key]);
                  return (
                    <article key={plugin.key} className="settings-market-card">
                      <div className="settings-market-card__top">
                        <div>
                          <div className={"settings-market-card__icon" + (plugin.iconImg ? " settings-market-card__icon--img" : "")} data-plugin-key={plugin.key}>
                          {plugin.iconImg
                            ? <img src={plugin.iconImg} alt={plugin.name} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentNode.textContent = plugin.icon; }} />
                            : plugin.icon}
                        </div>
                          <h3>{plugin.name}</h3>
                          <p>{plugin.description}</p>
                        </div>
                        <label className="settings-switch" aria-label={plugin.name + " toggle"}>
                          <input type="checkbox" checked={isEnabled} onChange={(event) => updatePlugin(plugin.key, event.target.checked)} />
                          <span className="settings-switch__slider"></span>
                        </label>
                      </div>

                      <div className="settings-market-card__tags">
                        {plugin.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                      </div>

                      <div className="settings-market-card__foot">
                        <span className={"status-badge " + (isEnabled ? "status-published" : "status-screening")}>
                          {isEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <button type="button" className={"btn" + (isEnabled ? "" : " accent")} onClick={() => updatePlugin(plugin.key, !isEnabled)}>
                          {isEnabled ? "Configure" : "Add"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* ── Pipedrive CRM Config Panel (shown when customerCrm is enabled) ── */}
              {draft.plugins.customerCrm && (
                <div className="card settings-subcard pd-config-panel" style={{ marginTop: 24 }}>
                  <div className="pd-config-panel__header">
                    <div className="pd-config-panel__brand">
                      <img
                        src="https://play-lh.googleusercontent.com/XAKratCqSJUb3ZmItve16p8RjiF0ZvN_czysEoqtGET7i-tsdJEozbnOYRM6jQNHEg=w240-h480"
                        alt="Pipedrive"
                        className="pd-config-panel__logo"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                      <div>
                        <div className="card-title" style={{ marginBottom: 2 }}>Pipedrive CRM — Connection Settings</div>
                        <div style={{ fontSize: 13, color: "var(--muted)" }}>
                          Connect your Pipedrive account to push applicant contact data (name, email, phone) directly into your CRM pipeline.
                        </div>
                      </div>
                    </div>
                    <span className={"status-badge " + (pdApiKeyConfigured ? "status-published" : "status-screening")}>
                      {pdApiKeyConfigured ? "API Key Configured" : "Not Connected"}
                    </span>
                  </div>

                  {/* Env-var status banner */}
                  <div className={"pd-env-banner " + (pdApiKeyConfigured ? "pd-env-banner--ok" : "pd-env-banner--warn")} style={{ marginTop: 18 }}>
                    <div className="pd-env-banner__icon">{pdApiKeyConfigured ? "✓" : "!"}</div>
                    <div>
                      {pdApiKeyConfigured
                        ? <><strong>PIPEDRIVE_API_KEY</strong> is configured on the server and ready to use.</>
                        : <><strong>PIPEDRIVE_API_KEY</strong> is not set. Go to your <strong>Render dashboard → Environment</strong>, add the variable, and redeploy.</>
                      }
                    </div>
                  </div>

                  {/* Test connection */}
                  <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={testPipedriveConnection}
                      disabled={pdTesting}
                    >
                      {pdTesting ? "Testing…" : "Test Connection"}
                    </button>

                    {pdTestResult && (
                      <div className={"settings-test-note " + (pdTestResult.ok ? "is-success" : "is-error")} style={{ margin: 0, flex: 1 }}>
                        {pdTestResult.ok && pdTestResult.user
                          ? `✓ Connected as ${pdTestResult.user.name || pdTestResult.user.email}${pdTestResult.user.company ? " · " + pdTestResult.user.company : ""}`
                          : pdTestResult.message}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0" }} />

                  {/* Sync section */}
                  <div className="pd-sync-section">
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Sync Applicants to Pipedrive</div>
                      <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 520 }}>
                        Push all applicants in the dashboard database to Pipedrive as Person contacts. Only name, email, and phone are sent. Contacts already in Pipedrive (matched by email) are skipped automatically.
                      </div>
                      {pdLastSyncAt && (
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                          Last sync: {new Date(pdLastSyncAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn accent"
                      style={{ minWidth: 160, marginTop: 12 }}
                      onClick={() => setPdSyncModal(true)}
                      disabled={!pdApiKeyConfigured || pdSyncing}
                    >
                      {pdSyncing ? "Syncing…" : "Sync to Pipedrive"}
                    </button>
                  </div>

                  {/* Last sync result */}
                  {pdSyncResult && (
                    <div className={"settings-test-note " + (pdSyncResult.ok !== false ? "is-success" : "is-error")} style={{ marginTop: 14 }}>
                      {pdSyncResult.message || (pdSyncResult.ok ? "Sync completed." : "Sync failed.")}
                      {pdSyncResult.synced != null && (
                        <div style={{ marginTop: 6, fontSize: 12 }}>
                          Created: <strong>{pdSyncResult.synced}</strong> &nbsp;·&nbsp;
                          Skipped (existing): <strong>{pdSyncResult.skipped}</strong> &nbsp;·&nbsp;
                          Failed: <strong>{pdSyncResult.failed}</strong>
                        </div>
                      )}
                      {pdSyncResult.errors && pdSyncResult.errors.length > 0 && (
                        <details style={{ marginTop: 8, fontSize: 12 }}>
                          <summary style={{ cursor: "pointer" }}>Show {pdSyncResult.errors.length} error{pdSyncResult.errors.length !== 1 ? "s" : ""}</summary>
                          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                            {pdSyncResult.errors.map((e, i) => (
                              <li key={i}>{e.applicant}: {e.reason}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeLayer === "mcp" && (
            <div className="settings-layer">
              <div className="settings-layer-head">
                <div>
                  <div className="mono eyebrow">MCP Configurations</div>
                  <div className="settings-layer-title">Service connections</div>
                  <p>Control external service availability, connection status, and shared MCP access defaults.</p>
                </div>
                <div className="settings-layer-stat card">
                  <div className="mono eyebrow">Connected services</div>
                  <div className="settings-layer-stat__value">{mcpConnectedCount}</div>
                </div>
              </div>

              <div className="settings-mcp-grid">
                <article className="settings-mcp-card settings-mcp-card--server">
                  <div className="settings-mcp-card__main">
                    <div className="settings-mcp-brand">
                      <img src={SETTINGS_MCP_CONNECTION.icon} alt="" />
                    </div>
                    <div>
                      <div className="mono eyebrow">Permanent Server Brand</div>
                      <h3>{SETTINGS_MCP_CONNECTION.name}</h3>
                      <p>{SETTINGS_MCP_CONNECTION.description}</p>
                      <div className={"status-badge " + (!draft.mcp.enabled ? "status-screening" : draft.mcp.connected ? "status-published" : "status-ready")}>
                        {!draft.mcp.connected ? "Not connected" : draft.mcp.enabled ? "Connected and active" : "Connected, temporarily blocked"}
                      </div>
                    </div>
                  </div>
                  <div className="settings-mcp-card__actions">
                    {!draft.mcp.connected && (
                      <button type="button" className="btn accent" onClick={connectMcpServer}>
                        Connect MCP
                      </button>
                    )}
                    <button type="button" className="btn" onClick={testMcpConnection} disabled={testingMcp}>
                      {testingMcp ? "Testing..." : "Test Connection"}
                    </button>
                    <label className="settings-switch" aria-label="roxanneMCP temporary block toggle" title={draft.mcp.enabled ? "Temporarily block MCP tools" : "Allow MCP tools"}>
                      <input type="checkbox" checked={Boolean(draft.mcp.enabled)} onChange={(event) => updateMcpField("enabled", event.target.checked)} />
                      <span className="settings-switch__slider"></span>
                    </label>
                    <span className="settings-toggle-label">{draft.mcp.enabled ? "On" : "Blocked"}</span>
                  </div>
                </article>
              </div>

              {mcpTestResult && (
                <div className="card settings-subcard">
                  <div className="card-title">Latest connection test</div>
                  <div className="settings-test-grid">
                    <div className="settings-test-kv">
                      <span className="mono eyebrow">Status</span>
                      <strong>{mcpTestResult.status} {mcpTestResult.statusText}</strong>
                    </div>
                    <div className="settings-test-kv">
                      <span className="mono eyebrow">Endpoint</span>
                      <strong className="mono">{mcpTestResult.endpoint || draft.mcp.endpoint || "Not configured"}</strong>
                    </div>
                    <div className="settings-test-kv">
                      <span className="mono eyebrow">Proxy path</span>
                      <strong className="mono">{mcpTestResult.proxyPath || draft.mcp.proxyPath}</strong>
                    </div>
                    <div className="settings-test-kv">
                      <span className="mono eyebrow">Server</span>
                      <strong>{mcpTestResult.serverLabel || draft.mcp.serverLabel}</strong>
                    </div>
                  </div>
                  <div className={"settings-test-note " + (mcpTestResult.ok ? "is-success" : "is-error")}>
                    {mcpTestResult.message || (mcpTestResult.ok ? "Connection succeeded." : "Connection failed.")}
                  </div>
                  {mcpTestResult.reauthRequired && mcpTestResult.provider && (
                    <div className="settings-provider-reauth" style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn accent"
                        onClick={() => startMcpProviderOauth(mcpTestResult.provider)}
                        disabled={oauthBusyProvider === mcpTestResult.provider}
                      >
                        {oauthBusyProvider === mcpTestResult.provider
                          ? `Opening ${mcpTestResult.provider}...`
                          : `Reconnect ${mcpTestResult.provider[0].toUpperCase() + mcpTestResult.provider.slice(1)}`}
                      </button>
                    </div>
                  )}
                  {!mcpTestResult.ok && mcpTestResult.raw && (
                    <div className="settings-test-raw mono">{mcpTestResult.raw}</div>
                  )}
                </div>
              )}

              <div className="card settings-subcard">
                <div className="card-title">MCP connection settings</div>
                <div className="settings-locked-brand">
                  <span className="mono eyebrow">Server</span>
                  <strong>{ROXANNE_MCP_LABEL}</strong>
                </div>
                <div className="settings-form-grid">
                  <div className="settings-field settings-field--wide">
                    <span className="mono eyebrow">MCP endpoint</span>
                    <div className="ifield settings-static-field mono">{draft.mcp.endpoint || "https://roxannemcp.onrender.com"}</div>
                  </div>
                  <div className="settings-field">
                    <span className="mono eyebrow">API key / token</span>
                    <div className="ifield settings-static-field">{draft.mcp.apiKeyConfigured ? "Configured on server" : "Set on server environment"}</div>
                  </div>
                  <label className="settings-field">
                    <span className="mono eyebrow">Default permissions</span>
                    <select className="ifield" value={draft.mcp.permissions} onChange={(event) => updateMcpField("permissions", event.target.value)}>
                      <option value="read-only">Read only</option>
                      <option value="read-write">Read and write</option>
                      <option value="admin-access">Admin access</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="settings-footer">
            <div className={"settings-feedback settings-feedback--" + messageTone}>
              {saving ? "Saving settings..." : (message || (hasChanges ? "You have unsaved changes in this settings draft." : "Settings are up to date and saved on the server."))}
            </div>
            <div className="settings-footer__actions">
              <button type="button" className="btn" onClick={resetDraft} disabled={saving}>Cancel / Reset</button>
              <button type="submit" className="btn accent" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </section>
      </form>

      {/* ── Pipedrive Sync Confirmation Modal ────────────────────────────── */}
      {pdSyncModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pd-modal-title">
          <div className="modal-box pd-confirm-modal">
            <div className="pd-confirm-modal__icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <h2 className="pd-confirm-modal__title" id="pd-modal-title">Sync applicants to Pipedrive?</h2>

            <div className="pd-confirm-modal__body">
              <p>You are about to upload applicant data from the HEYA dashboard database to your Pipedrive CRM account.</p>

              <div className="pd-confirm-modal__data-list">
                <div className="mono eyebrow" style={{ marginBottom: 8 }}>Data that will be sent to Pipedrive</div>
                <div className="pd-confirm-modal__data-row"><span className="pd-confirm-modal__data-icon">👤</span> Full name</div>
                <div className="pd-confirm-modal__data-row"><span className="pd-confirm-modal__data-icon">✉️</span> Email address</div>
                <div className="pd-confirm-modal__data-row"><span className="pd-confirm-modal__data-icon">📞</span> Phone number (if provided)</div>
              </div>

              <div className="pd-confirm-modal__notice">
                Applicants already in Pipedrive (matched by email) will be <strong>skipped</strong> — no duplicates will be created. CV files, notes, and screening data are <strong>not</strong> sent.
              </div>
            </div>

            <div className="pd-confirm-modal__actions">
              <button
                type="button"
                className="btn"
                onClick={() => setPdSyncModal(false)}
                disabled={pdSyncing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn accent"
                onClick={confirmPipedriveSync}
                disabled={pdSyncing}
              >
                {pdSyncing ? "Uploading…" : "Confirm — Push to Pipedrive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function initialsForSettings(name = "") {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DA";
}

window.OffersView = OffersView;
window.ReportsView = ReportsView;
window.SettingsView = SettingsView;
