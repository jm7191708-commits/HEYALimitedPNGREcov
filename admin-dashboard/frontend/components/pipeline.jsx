// Pipeline kanban — drag & drop between stages
function Pipeline() {
  const D = window.HEYA_DATA;
  const [cands, setCands] = React.useState(D.candidates);
  const [dragId, setDragId] = React.useState(null);
  const [overCol, setOverCol] = React.useState(null);
  const [filterJob, setFilterJob] = React.useState("all");

  const filtered = filterJob === "all" ? cands : cands.filter(c => c.job === filterJob);

  const byStage = {};
  D.stages.forEach(s => byStage[s.id] = []);
  filtered.forEach(c => byStage[c.stage]?.push(c));

  function onDragStart(e, id) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function onDragOver(e, stage) {
    e.preventDefault();
    setOverCol(stage);
  }
  function onDrop(e, stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setCands(prev => prev.map(c => c.id === id ? { ...c, stage } : c));
    setDragId(null);
    setOverCol(null);
  }
  function onDragEnd() {
    setDragId(null);
    setOverCol(null);
  }

  return (
    <div className="page" style={{ maxWidth: "none" }}>
      <div className="page-head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pipeline</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>All <em>{filtered.length}</em> active candidates</h1>
          <p className="page-sub">Drag a card to move it across stages. Cards that sit too long surface as warnings.</p>
        </div>
        <div className="cluster">
          <div className="searchbar" style={{ minWidth: 240 }}>
            <I.Search />
            <input placeholder="Filter candidates…" />
          </div>
          <select className="btn" value={filterJob} onChange={e => setFilterJob(e.target.value)} style={{ paddingRight: 8 }}>
            <option value="all">All requisitions</option>
            {D.jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <button className="btn"><I.Filter /> Filters</button>
          <button className="btn primary"><I.Plus /> Add candidate</button>
        </div>
      </div>

      <div className="kanban">
        {D.stages.map(stage => {
          const list = byStage[stage.id] || [];
          return (
            <div key={stage.id}
              className={"kanban-col" + (overCol === stage.id ? " drag-over" : "")}
              data-stage={stage.id}
              onDragOver={(e) => onDragOver(e, stage.id)}
              onDragLeave={() => setOverCol(null)}
              onDrop={(e) => onDrop(e, stage.id)}
            >
              <div className="kanban-col-head">
                <div className="name">{stage.name}</div>
                <div className="cluster">
                  <span className="count">{list.length}</span>
                  <button className="icon-btn" style={{ width: 22, height: 22 }}><I.Plus /></button>
                </div>
              </div>
              <div className="kanban-list">
                {list.map(c => {
                  const job = D.jobs.find(j => j.id === c.job);
                  const hot = c.score >= 85;
                  const stale = c.days > 14;
                  return (
                    <div key={c.id}
                      className={"cand-card" + (dragId === c.id ? " dragging" : "")}
                      draggable
                      onDragStart={(e) => onDragStart(e, c.id)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="top">
                        <div className={"avatar sm " + c.avatar}>{c.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="name">{c.name}</div>
                          <div className="role" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                        </div>
                        {hot && <span className="tag orange" title="High score">★ {c.score}</span>}
                      </div>
                      <div className="meta">
                        <span>{job?.team}</span>
                        <span className="sep">·</span>
                        <span>{c.source}</span>
                        <span className="sep">·</span>
                        <span>{c.days}d</span>
                      </div>
                      <div className="bar"><i style={{ width: c.score + "%" }}></i></div>
                      <div className="spread">
                        <div className="cluster">
                          {stale && <span className="tag red dot" style={{ fontSize: 9 }}>Stale</span>}
                          <span className="tag outline">{c.owner}</span>
                        </div>
                        <button className="icon-btn" style={{ width: 22, height: 22 }}><I.Dots /></button>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <div className="mono muted" style={{ padding: 16, textAlign: "center", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.Pipeline = Pipeline;
