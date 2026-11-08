// Dashboard — quick summary view with personalized greeting from settings.
function Dashboard({ positions, applicants, settings, setView, setActivePositionId }) {
  const open = React.useMemo(() => positions.filter((p) => p.status === "published"), [positions]);
  const ready = React.useMemo(() => positions.filter((p) => p.status === "ready"), [positions]);
  const draft = React.useMemo(() => positions.filter((p) => p.status === "draft"), [positions]);
  const interview = React.useMemo(() => applicants.filter((a) => a.status === "interview"), [applicants]);
  const offer = React.useMemo(() => applicants.filter((a) => a.offerStatus === "pending"), [applicants]);
  const shortlist = React.useMemo(() => applicants.filter((a) => a.status === "shortlisted"), [applicants]);
  const applicantCountsByPosition = React.useMemo(() => {
    return (applicants || []).reduce((acc, applicant) => {
      const key = String(applicant.positionId || "");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [applicants]);

  const accountSettings = settings?.accountSettings || {};
  const profile = settings?.profile || {};
  const displayName = accountSettings.fullName || profile.displayName || profile.username || "there";
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(now).replace(",", " ·");

  const stat = [
    { label: "Open positions", value: open.length, sub: ready.length + " ready · " + draft.length + " draft", onClick: () => setView("positions") },
    { label: "Applicants", value: applicants.length, sub: "across all positions", onClick: () => setView("applicants") },
    { label: "In interview", value: interview.length, sub: "this week", onClick: () => setView("interviews") },
    { label: "Offers out", value: offer.length, sub: "awaiting response", onClick: () => setView("offers") },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono eyebrow">{formattedDate}</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>{greeting}, <em>{firstName}</em>.</h1>
          <div className="page-sub">A snapshot of your hiring this week — open positions, pipeline, and what needs your attention.</div>
        </div>
        <div className="cluster">
          <button className="btn accent" onClick={() => { setActivePositionId("new"); setView("requisitions"); }}>
            <I.Plus /><span>New position</span>
          </button>
        </div>
      </div>

      <div className="grid cols-4">
        {stat.map((s) => (
          <div key={s.label} className="card stat clickable" onClick={s.onClick}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Active positions</div>
            <button className="btn ghost sm" onClick={() => setView("positions")}>View all →</button>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {open.length === 0 && <div style={{ color: "var(--muted)", padding: "12px 0" }}>No published positions yet.</div>}
            {open.slice(0, 5).map((p) => {
              const apps = applicantCountsByPosition[String(p.id)] || 0;
              return (
                <div key={p.id} className="list-row" onClick={() => { setActivePositionId(p.id); setView("positions"); }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.title}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.client} · {p.location}</div>
                  </div>
                  <div className="cluster">
                    <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>{apps} applicants</span>
                    <span className={"status-badge status-published"}>Live</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Needs attention</div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {ready.map((p) => (
              <div key={p.id} className="list-row" onClick={() => { setActivePositionId(p.id); setView("positions"); }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{p.title}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Ready to publish</div>
                </div>
                <span className="status-badge status-ready">Ready</span>
              </div>
            ))}
            {shortlist.slice(0, 3).map((a) => (
              <div key={a.id} className="list-row" onClick={() => setView("shortlist")}>
                <div>
                  <div style={{ fontWeight: 500 }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Shortlisted — schedule interview</div>
                </div>
                <I.ChevronRight />
              </div>
            ))}
            {ready.length === 0 && shortlist.length === 0 && (
              <div style={{ color: "var(--muted)", padding: "12px 0" }}>Inbox zero — nothing urgent right now.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
