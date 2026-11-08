// Requisitions
function Jobs() {
  const D = window.HEYA_DATA;
  const [statusFilter, setStatusFilter] = React.useState("all");
  const filtered = statusFilter === "all" ? D.jobs : D.jobs.filter(j => j.status === statusFilter);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Requisitions</div>
          <h1 className="page-title" style={{ marginTop: 8 }}><em>{filtered.length}</em> open roles · 48-plan</h1>
          <p className="page-sub">Every req with an owner, urgency, and lived pipeline depth. Sorted by age.</p>
        </div>
        <div className="cluster">
          <div className="role-switch">
            {[["all","All"],["active","Active"],["paused","Paused"]].map(([id,l]) => (
              <button key={id} className={"role-pill" + (statusFilter === id ? " active" : "")} onClick={() => setStatusFilter(id)}>{l}</button>
            ))}
          </div>
          <button className="btn"><I.Filter /> Filters</button>
          <button className="btn primary"><I.Plus /> New requisition</button>
        </div>
      </div>

      <div className="card flush">
        <div className="req-row" style={{ borderBottom: "1px solid var(--line)", background: "#faf6ec" }}>
          <div></div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Role</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hiring panel</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pipeline depth</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Open</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
          <div></div>
        </div>
        {filtered.map(j => {
          const owner = D.team.find(t => t.initials === j.owner);
          return (
            <div key={j.id} className="req-row">
              <div>
                {j.priority === "critical" && <span style={{ color: "var(--danger)" }}><I.Flag /></span>}
                {j.priority === "high" && <span style={{ color: "var(--primary)" }}><I.Flag /></span>}
                {j.priority === "medium" && <span style={{ color: "var(--gold)" }}><I.Flag /></span>}
                {j.priority === "low" && <span style={{ color: "var(--muted-2)" }}><I.Flag /></span>}
              </div>
              <div>
                <div className="req-title">{j.title}</div>
                <div className="req-meta">{j.team} · {j.location} · {j.level}</div>
              </div>
              <div className="stack-row">
                <div className={"avatar sm " + (owner?.tone || "tone-c")}>{j.owner}</div>
                <div className="avatar sm tone-a">MK</div>
                <div className="avatar sm tone-b">AP</div>
                <div className="avatar sm tone-d">+2</div>
                <span className="more">{owner?.name || "Owner"}</span>
              </div>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 30px", gap: 6, alignItems: "center" }}>
                  <ProgressBar value={j.pipeline} max={50} tone="orange" />
                  <span className="num" style={{ fontSize: 11, textAlign: "right", color: "var(--muted)" }}>{j.pipeline}</span>
                </div>
                <div className="mono muted" style={{ fontSize: 10, marginTop: 4 }}>{j.applicants} applicants</div>
              </div>
              <div>
                <div className="num">{j.days}<span className="muted" style={{ fontSize: 11 }}>d</span></div>
                <div className="mono muted" style={{ fontSize: 10 }}>since open</div>
              </div>
              <div>
                {j.status === "active" ? <span className="tag green dot">Active</span> : <span className="tag outline">Paused</span>}
              </div>
              <div className="cluster" style={{ justifyContent: "flex-end" }}>
                <button className="icon-btn"><I.Dots /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.Jobs = Jobs;
