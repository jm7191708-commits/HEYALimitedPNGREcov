// Activity feed (full page)
function Activity() {
  const D = window.HEYA_DATA;
  const feed = [...D.activity, ...D.activity, ...D.activity].slice(0, 18);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Activity</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Everything happening, <em>chronological</em></h1>
          <p className="page-sub">Every move on every candidate, every AI suggestion, every note. Filter what matters.</p>
        </div>
        <div className="cluster">
          <button className="btn">Today</button>
          <button className="btn"><I.Filter /> All types</button>
        </div>
      </div>

      <div className="card flush">
        {feed.map((a, i) => (
          <div key={i} className="feed-row" style={{ padding: "14px 20px", borderBottom: i < feed.length - 1 ? "1px solid var(--line-2)" : 0 }}>
            <div className={"avatar sm " + (a.who === "AI Assistant" ? "tone-d" : ["tone-a","tone-b","tone-c","tone-e"][i % 4])}>
              {a.who === "AI Assistant" ? <I.Spark /> : a.who.split(" ").map(x => x[0]).slice(0,2).join("")}
            </div>
            <div>
              <div><span className="who">{a.who}</span> <span className="muted">{a.action}</span> <span className="who">{a.target}</span> {a.to && <><span className="muted">→</span> <span className="tag gold">{a.to}</span></>}</div>
              <div className="mono muted" style={{ fontSize: 10, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Requisition · Staff Product Designer
              </div>
            </div>
            <span className="time">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Activity = Activity;
