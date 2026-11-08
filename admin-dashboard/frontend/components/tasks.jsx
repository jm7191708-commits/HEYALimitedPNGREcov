// Tasks
function Tasks({ role }) {
  const D = window.HEYA_DATA;
  const [items, setItems] = React.useState(D.tasks);
  const visible = items.filter(t => role.id === "leader" ? true : t.role === role.id || t.role === "leader" && role.id === "leader");
  // simpler: show all but mark role
  const list = items;

  function toggle(id) {
    setItems(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  const groups = {
    "Overdue": list.filter(t => !t.done && t.due === "Overdue"),
    "Today": list.filter(t => !t.done && t.due.includes("Today")),
    "This week": list.filter(t => !t.done && !t.due.includes("Today") && t.due !== "Overdue"),
    "Completed": list.filter(t => t.done)
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tasks</div>
          <h1 className="page-title" style={{ marginTop: 8 }}><em>{list.filter(t => !t.done).length}</em> open · sharp & specific</h1>
          <p className="page-sub">Recruiting work, broken down. AI pre-drafted the next steps for each — accept, revise, or dismiss.</p>
        </div>
        <div className="cluster">
          <button className="btn"><I.Filter /> Mine only</button>
          <button className="btn primary"><I.Plus /> Add task</button>
        </div>
      </div>

      <div className="card flush">
        {Object.entries(groups).map(([label, rows]) => rows.length === 0 ? null : (
          <div key={label}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#faf6ec", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <span className="mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: label === "Overdue" ? "var(--danger)" : "var(--muted)" }}>{label}</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{rows.length}</span>
            </div>
            {rows.map(t => (
              <div key={t.id} className={"task-row" + (t.done ? " done" : "")}>
                <div className="check" onClick={() => toggle(t.id)}>
                  {t.done && <I.Check />}
                </div>
                <div>
                  <div className="title" style={{ fontSize: 13.5, fontWeight: 500 }}>{t.title}</div>
                  <div className="mono muted" style={{ fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    For: {t.role === "recruiter" ? "Recruiter" : t.role === "manager" ? "Hiring Mgr" : "Leadership"}
                  </div>
                </div>
                <div className={"due" + (t.due === "Overdue" ? " overdue" : "")}>{t.due}</div>
                <div>
                  <span className={"tag " + (t.priority === "high" ? "red" : t.priority === "medium" ? "gold" : "outline")}>{t.priority}</span>
                </div>
                <div className="cluster" style={{ justifyContent: "flex-end" }}>
                  <button className="icon-btn"><I.Dots /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

window.Tasks = Tasks;
