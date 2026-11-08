// Talent Pool — sourcing search
function TalentPool() {
  const D = window.HEYA_DATA;
  const pool = D.candidates.concat(D.candidates).slice(0, 12).map((c, i) => ({ ...c, id: c.id + "_t" + i }));

  const skills = ["React", "TypeScript", "Design Systems", "Figma", "Go", "Python", "ML", "PyTorch", "Pricing", "Strategy", "Brand", "Growth"];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Talent Pool · 2,184 contacts</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>The <em>silver medalists</em> — and people who'd say yes today.</h1>
          <p className="page-sub">Past finalists, warm intros, and AI-scored matches across your network.</p>
        </div>
        <div className="cluster">
          <button className="btn"><I.Spark style={{ color: "var(--primary)" }} /> AI Search</button>
          <button className="btn primary"><I.Plus /> Add to pool</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="cluster" style={{ gap: 14 }}>
          <div className="searchbar" style={{ flex: 1, maxWidth: "none" }}>
            <I.Search />
            <input placeholder="staff product designer, fintech, NYC, will relocate, > 7y…" defaultValue="staff designer · fintech · NYC area · past finalist" />
          </div>
          <button className="btn">Search</button>
        </div>
        <div className="cluster" style={{ marginTop: 12 }}>
          <span className="mono muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Filters:</span>
          {["Past finalists", "Open to work", "Senior+", "Has referrer"].map(f => (
            <span key={f} className="tag outline">{f} ×</span>
          ))}
          <span className="mono muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginLeft: 12 }}>Skills:</span>
          {skills.slice(0, 6).map(s => <span key={s} className="tag">{s}</span>)}
        </div>
      </div>

      <div className="talent-grid">
        {pool.map((c, i) => (
          <div key={c.id} className="talent-card">
            <div className="head">
              <div className={"avatar lg " + c.avatar}>{c.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{c.name}</div>
                <div className="title">{c.title}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--primary)" }}>{c.score}</div>
                <div className="mono muted" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>match</div>
              </div>
            </div>
            <div className="body">
              {["Ex-Stripe, Ex-Figma. Built design systems at scale.", "12y in fintech. Open to NYC, hybrid.", "Past finalist for VP Design Q3'25.", "Referred by Marcus K. Active in talent pool."][i % 4]}
            </div>
            <div className="skills">
              {["Design Systems", "Figma", "Brand", "Strategy", "Fintech"].slice(0, (i % 3) + 2).map(s => <span key={s} className="tag">{s}</span>)}
              {i % 3 === 0 && <span className="tag green dot">Open</span>}
              {i % 4 === 0 && <span className="tag gold">Silver</span>}
            </div>
            <div className="actions">
              <button className="btn sm" style={{ flex: 1 }}>Open profile</button>
              <button className="btn sm primary"><I.Send /> Reach out</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.TalentPool = TalentPool;
