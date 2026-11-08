/* staleness = not contacted for 180+ days (or never contacted, added 180+ days ago) */
function isTalentStale(talent) {
  const refDate = talent.lastContactedAt || talent.createdAt;
  if (!refDate) return false;
  const daysSince = (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 180;
}

function TalentPoolView({ talents = [], onUpdate, onDelete, onBulkDelete, onAdd, onEditingChange, pendingRefreshCount = 0, onApplyPendingRefresh, positions = [] }) {
  const [activeId, setActiveId] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState("all");
  const [selected, setSelected] = React.useState([]);
  const [editing, setEditing] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const [selectionMode, setSelectionMode] = React.useState(false);

  /* collect all unique tags across all talent entries */
  const allTags = React.useMemo(() => {
    const tagSet = new Set();
    talents.forEach((t) => (t.tags || []).forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [talents]);

  const filtered = talents.filter((talent) => {
    const q = search.trim().toLowerCase();
    if (q && ![talent.name, talent.title, talent.location, talent.desiredRoles, ...(talent.tags || []), ...(talent.skills || [])].join(" ").toLowerCase().includes(q)) return false;
    if (tagFilter !== "all" && !(talent.tags || []).includes(tagFilter)) return false;
    return true;
  });
  const filteredIds = filtered.map((talent) => talent.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.includes(id));

  React.useEffect(() => {
    const ids = talents.map((talent) => talent.id);
    setSelected((current) => current.filter((id) => ids.includes(id)));
    if (activeId && !ids.includes(activeId)) setActiveId(null);
  }, [talents.length]);

  React.useEffect(() => {
    if (!selected.length && selectionMode) {
      setSelectionMode(false);
    }
  }, [selected.length, selectionMode]);

  React.useEffect(() => {
    if (onEditingChange) onEditingChange(Boolean(activeId || editing || adding));
  }, [activeId, editing, adding, onEditingChange]);

  React.useEffect(() => () => {
    if (onEditingChange) onEditingChange(false);
  }, [onEditingChange]);

  function toggleOne(id) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function toggleAll() {
    setSelectionMode(true);
    setSelected(allSelected ? [] : filteredIds);
  }

  function enableSelectionFor(id) {
    setSelectionMode(true);
    setSelected((current) => current.includes(id) ? current : [...current, id]);
  }

  async function deleteOne(talent) {
    if (!talent || !onDelete) return;
    if (!window.confirm(`Delete talent pool profile for "${talent.name || "this person"}"?`)) return;
    await onDelete(talent.id);
    setSelected((current) => current.filter((id) => id !== talent.id));
  }

  async function deleteSelected() {
    if (!selected.length || !onBulkDelete) return;
    if (!window.confirm(`Delete ${selected.length} selected talent pool profile${selected.length === 1 ? "" : "s"}?`)) return;
    await onBulkDelete(selected);
    setSelected([]);
  }

  async function saveEdit(payload) {
    if (!editing || !onUpdate) return;
    await onUpdate(editing.id, payload);
    setEditing(null);
  }

  const active = activeId ? talents.find((talent) => talent.id === activeId) : null;
  if (active) return <TalentProfile talent={active} positions={positions} onBack={() => setActiveId(null)} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="mono eyebrow">Talent Pool / {talents.length} contacts</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Talent <em>pool</em></h1>
          <p className="page-sub">Candidates who submitted CVs for future opportunities through the Careers portal.</p>
        </div>
        <div className="cluster">
          {pendingRefreshCount > 0 && (
            <button className="btn ghost sm" onClick={onApplyPendingRefresh}>
              New items available ({pendingRefreshCount})
            </button>
          )}
          {selected.length > 0 && (
            <button className="btn ghost sm" onClick={deleteSelected}>Delete selected ({selected.length})</button>
          )}
          {onAdd && (
            <button className="btn primary" onClick={() => setAdding(true)}>
              <I.Plus /> Add to pool
            </button>
          )}
        </div>
      </div>

      <div className="card talent-toolbar" style={{ marginBottom: 16 }}>
        <label className="bulk-check">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          <span>Select all</span>
        </label>
        <div className="searchbar" style={{ flex: 1, maxWidth: "none" }}>
          <I.Search />
          <input placeholder="Search by name, title, location, skill, or tag..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {allTags.length > 0 && (
          <select className="ifield" style={{ width: 160 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="all">All tags</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        )}
      </div>

      <div className="talent-grid">
        {filtered.length === 0 && (
          <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "var(--muted)" }}>
            No talent pool entries match this view.
          </div>
        )}
        {filtered.map((talent) => (
          <div key={talent.id} className="talent-card clickable" onClick={() => setActiveId(talent.id)}>
            <div className="talent-card__controls">
              <div className="talent-card__select-wrap">
                {selectionMode && (
                  <input
                    className="talent-select"
                    type="checkbox"
                    checked={selected.includes(talent.id)}
                    onChange={(event) => { event.stopPropagation(); toggleOne(talent.id); }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${talent.name}`}
                  />
                )}
              </div>
              <TalentCardMenu
                isSelected={selected.includes(talent.id)}
                selectionMode={selectionMode}
                onSelect={(event) => { event.stopPropagation(); enableSelectionFor(talent.id); }}
                onEdit={(event) => { event.stopPropagation(); setEditing(talent); }}
                onDelete={(event) => { event.stopPropagation(); deleteOne(talent); }}
              />
            </div>
            <div className="head">
              <div className="avatar tone-c">{initialsFor(talent.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{talent.name}</div>
                <div className="title">{talent.title}</div>
              </div>
            </div>
            <div className="talent-meta">
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{talent.location || "Location not provided"}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}> / {talent.yearsExperienceLabel || "Experience not provided"}</span>
            </div>
            <div className="body">{talent.headline}</div>
            <div className="skills">
              {(talent.skills || []).slice(0, 3).map((skill) => <span key={skill} className="tag-pill tag-needs-review">{skill}</span>)}
              {(talent.tags || []).slice(0, 2).map((tag) => <span key={tag} className="tag-pill talent-tag-pill">{tag}</span>)}
              {isTalentStale(talent) && <span className="tag-pill talent-stale-pill">Stale</span>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <TalentEditModal
          talent={editing}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
      {adding && (
        <TalentAddModal
          onCancel={() => setAdding(false)}
          onSave={async (payload) => {
            if (onAdd) await onAdd(payload);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function TalentCardMenu({ isSelected, selectionMode, onSelect, onEdit, onDelete }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="row-actions talent-card-actions" onClick={(event) => event.stopPropagation()}>
      <button className="icon-btn" title="Talent actions" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>
        <I.Dots />
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={(event) => { event.stopPropagation(); setOpen(false); }} />
          <div className="menu">
            {!isSelected && (
              <button className="menu-item" onClick={(event) => { setOpen(false); onSelect(event); }}>
                {selectionMode ? "Select this card" : "Enable select mode"}
              </button>
            )}
            <button className="menu-item" onClick={(event) => { setOpen(false); onEdit(event); }}>Edit</button>
            <button className="menu-item danger" onClick={(event) => { setOpen(false); onDelete(event); }}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

function TalentEditModal({ talent, onCancel, onSave }) {
  const [draft, setDraft] = React.useState({
    name: talent.name || "",
    email: talent.email || "",
    phone: talent.phone || "",
    title: talent.title || "",
    location: talent.location || "",
    yearsExperience: talent.yearsExperienceLabel || "",
    skills: (talent.skills || []).join(", "),
    headline: talent.headline || "",
    tags: (talent.tags || []).join(", "),
    consentExpiresAt: talent.consentExpiresAt ? talent.consentExpiresAt.slice(0, 10) : ""
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
    } catch (err) {
      setError(err.message || "Unable to save this profile.");
      setSaving(false);
    }
  }

  return (
    <div className="publish-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="edit-modal">
        <div className="edit-modal-head">
          <div>
            <div className="mono eyebrow">Talent profile</div>
            <div className="edit-modal-title">Edit profile</div>
          </div>
          <button className="icon-btn" onClick={onCancel} title="Close">x</button>
        </div>
        <div className="edit-modal-body">
          <div className="grid cols-2" style={{ gap: 12 }}>
            <TalentField label="Name"><input className="ifield" value={draft.name} onChange={(e) => update("name", e.target.value)} /></TalentField>
            <TalentField label="Email"><input className="ifield" value={draft.email} onChange={(e) => update("email", e.target.value)} /></TalentField>
            <TalentField label="Phone"><input className="ifield" value={draft.phone} onChange={(e) => update("phone", e.target.value)} /></TalentField>
            <TalentField label="Title / desired roles"><input className="ifield" value={draft.title} onChange={(e) => update("title", e.target.value)} /></TalentField>
            <TalentField label="Location"><input className="ifield" value={draft.location} onChange={(e) => update("location", e.target.value)} /></TalentField>
            <TalentField label="Experience"><input className="ifield" value={draft.yearsExperience} onChange={(e) => update("yearsExperience", e.target.value)} /></TalentField>
          </div>
          <div style={{ marginTop: 12 }}>
            <TalentField label="Industries / skills"><input className="ifield" value={draft.skills} onChange={(e) => update("skills", e.target.value)} /></TalentField>
          </div>
          <div style={{ marginTop: 12 }}>
            <TalentField label="Tags (comma-separated, e.g. Finance, Senior, PNG-National)">
              <input className="ifield" value={draft.tags} onChange={(e) => update("tags", e.target.value)} placeholder="e.g. Finance, Senior, Available Now" />
            </TalentField>
          </div>
          <div style={{ marginTop: 12 }}>
            <TalentField label="Consent expiry date (data retention)">
              <input className="ifield" type="date" value={draft.consentExpiresAt} onChange={(e) => update("consentExpiresAt", e.target.value)} />
            </TalentField>
          </div>
          <div style={{ marginTop: 12 }}>
            <TalentField label="Summary"><textarea className="ifield" rows="5" value={draft.headline} onChange={(e) => update("headline", e.target.value)} /></TalentField>
          </div>
          {error && <div className="inbox-action-status is-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="edit-modal-foot">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Changes update only this talent pool profile.</span>
          <div className="cluster">
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button className="btn accent" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TalentProfile({ talent, onBack, positions = [] }) {
  const [lastContacted, setLastContacted] = React.useState(talent.lastContactedAt || null);
  const [contactBusy, setContactBusy]     = React.useState(false);
  const stale = isTalentStale({ ...talent, lastContactedAt: lastContacted });

  /* keyword match against open positions */
  const matchedPositions = React.useMemo(() => {
    if (!positions.length || !talent.desiredRoles) return [];
    const keywords = (talent.desiredRoles + " " + (talent.skills || []).join(" "))
      .toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
    return positions
      .filter((p) => p.status === "published")
      .map((p) => {
        const haystack = (p.title + " " + (p.department || "") + " " + (p.location || "")).toLowerCase();
        const hits = keywords.filter((kw) => haystack.includes(kw)).length;
        return { ...p, hits };
      })
      .filter((p) => p.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 5);
  }, [positions, talent.desiredRoles, talent.skills]);

  async function handleMarkContacted() {
    setContactBusy(true);
    try {
      const resp = await window.HEYA_API.markTalentPoolContacted(talent.id);
      setLastContacted(resp.lastContactedAt || new Date().toISOString());
    } catch {}
    finally { setContactBusy(false); }
  }

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 14 }}>← Back to talent pool</button>

      <div className="talent-profile-card">
        <div className="talent-profile-hero">
          <div className="avatar tone-c" style={{ width: 88, height: 88, fontSize: 28 }}>{initialsFor(talent.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 className="page-title" style={{ fontSize: 28, margin: 0 }}>{talent.name}</h1>
              {stale && <span className="tag-pill talent-stale-pill">Stale — not contacted in 180+ days</span>}
            </div>
            <div style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 6 }}>{talent.title}</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              {talent.location || "Location not provided"} · {talent.yearsExperienceLabel || "Experience not provided"}
            </div>
            {(talent.tags || []).length > 0 && (
              <div className="cluster" style={{ marginTop: 8, gap: 6 }}>
                {talent.tags.map((tag) => <span key={tag} className="tag-pill talent-tag-pill">{tag}</span>)}
              </div>
            )}
            <div className="cluster" style={{ marginTop: 12, gap: 8 }}>
              {talent.cvFile?.downloadUrl && <a className="btn accent sm" href={talent.cvFile.downloadUrl} target="_blank" rel="noreferrer">Download CV</a>}
              {talent.coverLetterFile?.downloadUrl && <a className="btn sm" href={talent.coverLetterFile.downloadUrl} target="_blank" rel="noreferrer">Cover Letter</a>}
              <button className="btn sm" onClick={handleMarkContacted} disabled={contactBusy}>
                {contactBusy ? "Saving..." : "✓ Mark contacted"}
              </button>
            </div>
            {lastContacted && (
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                Last contacted: {new Date(lastContacted).toLocaleDateString("en-PG")}
              </div>
            )}
          </div>
        </div>

        <div className="talent-profile-body">
          <div className="stack" style={{ gap: 14 }}>
            <Section title="Summary">
              <div style={{ lineHeight: 1.55 }}>{talent.headline}</div>
            </Section>
            <Section title="Preferred roles">
              <div>{talent.desiredRoles || "Not provided"}</div>
            </Section>
            <Section title="Preferred work location">
              <div>{talent.preferredWorkLocation || "Not provided"}</div>
            </Section>
            <Section title="Industries / skills">
              <div className="cluster" style={{ flexWrap: "wrap", gap: 6 }}>
                {(talent.skills || []).length
                  ? talent.skills.map((skill) => <span key={skill} className="tag-pill tag-needs-review">{skill}</span>)
                  : <span style={{ color: "var(--muted)" }}>Not provided</span>}
              </div>
            </Section>
            {matchedPositions.length > 0 && (
              <Section title="Matching open positions">
                <div className="stack" style={{ gap: 8 }}>
                  {matchedPositions.map((pos) => (
                    <div key={pos.id} className="talent-match-row">
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{pos.title}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          {pos.location || "Location not set"}{pos.department ? ` · ${pos.department}` : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 600, flexShrink: 0 }}>
                        {pos.hits} match{pos.hits !== 1 ? "es" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            <Section title="Cover letter / notes">
              <div style={{ whiteSpace: "pre-wrap" }}>{talent.coverLetterText || talent.additionalNotes || "Not provided"}</div>
            </Section>
          </div>

          <div className="stack" style={{ gap: 14 }}>
            <Section title="Contact">
              <KVTalent k="Email" v={talent.email} />
              <KVTalent k="Phone" v={talent.phone} />
            </Section>
            <Section title="Profile details">
              <KVTalent k="Highest qualification" v={talent.highestQualification || talent.education} />
              <KVTalent k="Availability" v={talent.availability} />
              <KVTalent k="CV link" v={talent.cvLink} />
              <KVTalent k="Cover letter link" v={talent.coverLetterLink} />
            </Section>
            <Section title="Engagement">
              <KVTalent k="Last contacted" v={lastContacted ? new Date(lastContacted).toLocaleDateString("en-PG") : "Never"} />
              <KVTalent k="Consent expires" v={talent.consentExpiresAt ? new Date(talent.consentExpiresAt).toLocaleDateString("en-PG") : "Not set"} />
              <KVTalent k="Submitted" v={talent.createdAt ? new Date(talent.createdAt).toLocaleDateString("en-PG") : ""} />
              <KVTalent k="Source" v={talent.source} />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== ADD TALENT MODAL =====

function readFileAsUpload(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      // dataUrl = "data:<mime>;base64,<data>"
      const base64 = dataUrl.split(",")[1] || "";
      resolve({ name: file.name, type: file.type, contentBase64: base64 });
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function TalentAddModal({ onCancel, onSave }) {
  const EMPTY = {
    fullName: "", email: "", phone: "",
    desiredRoles: "", currentLocation: "", yearsExperience: "",
    preferredWorkLocation: "", highestQualification: "",
    industries: "", keySkills: "", availability: "",
    source: "Manual entry",
    summary: "", additionalNotes: "",
  };
  const [draft, setDraft] = React.useState(EMPTY);
  const [cvFile, setCvFile] = React.useState(null);
  const [coverMode, setCoverMode] = React.useState("upload"); // "upload" | "write"
  const [coverFile, setCoverFile] = React.useState(null);
  const [coverText, setCoverText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function up(field, value) { setDraft((d) => ({ ...d, [field]: value })); }

  async function handleSave() {
    setError("");
    if (!draft.fullName.trim()) { setError("Full name is required."); return; }
    if (!draft.email.trim()) { setError("Email address is required."); return; }
    setSaving(true);
    try {
      const cvUpload = cvFile ? await readFileAsUpload(cvFile) : null;
      let coverLetterUpload = null;
      if (coverMode === "upload" && coverFile) {
        coverLetterUpload = await readFileAsUpload(coverFile);
      }
      const payload = {
        ...draft,
        message: draft.summary,
        coverLetterText: coverMode === "write" ? coverText : "",
        cvUpload,
        coverLetterUpload,
        sourcePath: "/dashboard/talent-pool/manual-add",
      };
      await onSave(payload);
    } catch (err) {
      setError(err.message || "Could not save. Please try again.");
      setSaving(false);
    }
  }

  const sectionHead = (label) => (
    <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid var(--line-2)", paddingBottom: 6, marginBottom: 2, marginTop: 8 }}>
      <span className="mono eyebrow">{label}</span>
    </div>
  );

  return (
    <div className="publish-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="edit-modal" style={{ width: "min(860px, 95vw)" }}>
        <div className="edit-modal-head">
          <div>
            <div className="mono eyebrow">Talent Pool</div>
            <div className="edit-modal-title">Add talent manually</div>
          </div>
          <button className="icon-btn" onClick={onCancel} title="Close">✕</button>
        </div>

        <div className="edit-modal-body">
          <div className="form-grid">

            {sectionHead("Personal information")}

            <TalentField label="Full name *">
              <input className="ifield" placeholder="e.g. Jane Smith" value={draft.fullName} onChange={(e) => up("fullName", e.target.value)} />
            </TalentField>
            <TalentField label="Email address *">
              <input className="ifield" type="email" placeholder="jane@example.com" value={draft.email} onChange={(e) => up("email", e.target.value)} />
            </TalentField>
            <TalentField label="Phone">
              <input className="ifield" placeholder="+675 xxx xxxx" value={draft.phone} onChange={(e) => up("phone", e.target.value)} />
            </TalentField>
            <TalentField label="Source">
              <select className="ifield" value={draft.source} onChange={(e) => up("source", e.target.value)}>
                <option>Manual entry</option>
                <option>Referral</option>
                <option>LinkedIn</option>
                <option>Job board</option>
                <option>Direct approach</option>
                <option>Walk-in</option>
                <option>Past applicant</option>
                <option>Other</option>
              </select>
            </TalentField>

            {sectionHead("Professional profile")}

            <TalentField label="Desired role(s) / Job title">
              <input className="ifield" placeholder="e.g. Senior Mechanical Engineer" value={draft.desiredRoles} onChange={(e) => up("desiredRoles", e.target.value)} />
            </TalentField>
            <TalentField label="Industries">
              <input className="ifield" placeholder="e.g. Mining, Construction, Oil & Gas" value={draft.industries} onChange={(e) => up("industries", e.target.value)} />
            </TalentField>
            <TalentField label="Key skills">
              <input className="ifield" placeholder="Comma-separated — e.g. Safety, FIFO, Supervision" value={draft.keySkills} onChange={(e) => up("keySkills", e.target.value)} />
            </TalentField>
            <TalentField label="Highest qualification">
              <input className="ifield" placeholder="e.g. Bachelor of Engineering" value={draft.highestQualification} onChange={(e) => up("highestQualification", e.target.value)} />
            </TalentField>
            <TalentField label="Years of experience">
              <select className="ifield" value={draft.yearsExperience} onChange={(e) => up("yearsExperience", e.target.value)}>
                <option value="">— Select —</option>
                <option>Less than 1 year</option>
                <option>1–2 years</option>
                <option>3–5 years</option>
                <option>6–10 years</option>
                <option>10–15 years</option>
                <option>15+ years</option>
              </select>
            </TalentField>
            <TalentField label="Availability">
              <select className="ifield" value={draft.availability} onChange={(e) => up("availability", e.target.value)}>
                <option value="">— Select —</option>
                <option>Open to work — immediately available</option>
                <option>Available in 2–4 weeks</option>
                <option>Available in 1–3 months</option>
                <option>Passively looking</option>
                <option>Not currently looking</option>
              </select>
            </TalentField>

            {sectionHead("Location")}

            <TalentField label="Current location">
              <input className="ifield" placeholder="e.g. Port Moresby, NCD" value={draft.currentLocation} onChange={(e) => up("currentLocation", e.target.value)} />
            </TalentField>
            <TalentField label="Preferred work location">
              <input className="ifield" placeholder="e.g. FIFO, Lae, Open to relocation" value={draft.preferredWorkLocation} onChange={(e) => up("preferredWorkLocation", e.target.value)} />
            </TalentField>

            {sectionHead("Summary & notes")}

          </div>

          <div style={{ marginTop: 12 }}>
            <TalentField label="Professional summary">
              <textarea className="ifield" rows="4" placeholder="Brief background, strengths, what makes this candidate stand out..." value={draft.summary} onChange={(e) => up("summary", e.target.value)} />
            </TalentField>
          </div>
          <div style={{ marginTop: 12 }}>
            <TalentField label="Internal notes">
              <textarea className="ifield" rows="3" placeholder="Any internal notes, referral context, next steps..." value={draft.additionalNotes} onChange={(e) => up("additionalNotes", e.target.value)} />
            </TalentField>
          </div>

          {/* Documents */}
          <div style={{ borderBottom: "1px solid var(--line-2)", paddingBottom: 6, marginTop: 20, marginBottom: 12 }}>
            <span className="mono eyebrow">Documents</span>
          </div>

          <div className="form-grid">
            <TalentField label="CV / Resume (PDF, DOC, DOCX)">
              <input
                className="ifield"
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ paddingTop: 6 }}
                onChange={(e) => setCvFile(e.target.files[0] || null)}
              />
              {cvFile && <div className="mono" style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>✓ {cvFile.name}</div>}
            </TalentField>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Cover letter</label>
                <div className="cluster" style={{ gap: 0, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 7, overflow: "hidden", padding: 2 }}>
                  <button
                    className={"btn sm" + (coverMode === "upload" ? " primary" : "")}
                    style={{ borderRadius: 5, padding: "2px 10px", fontSize: 11 }}
                    onClick={() => setCoverMode("upload")}
                    type="button"
                  >Upload file</button>
                  <button
                    className={"btn sm" + (coverMode === "write" ? " primary" : "")}
                    style={{ borderRadius: 5, padding: "2px 10px", fontSize: 11 }}
                    onClick={() => setCoverMode("write")}
                    type="button"
                  >Write</button>
                </div>
              </div>
              {coverMode === "upload" ? (
                <>
                  <input
                    className="ifield"
                    type="file"
                    accept=".pdf,.doc,.docx,.rtf,.txt"
                    style={{ paddingTop: 6 }}
                    onChange={(e) => setCoverFile(e.target.files[0] || null)}
                  />
                  {coverFile && <div className="mono" style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>✓ {coverFile.name}</div>}
                </>
              ) : (
                <textarea
                  className="ifield"
                  rows="5"
                  placeholder="Write the cover letter here..."
                  value={coverText}
                  onChange={(e) => setCoverText(e.target.value)}
                />
              )}
            </div>
          </div>

          {error && (
            <div className="inbox-action-status is-error" style={{ marginTop: 16 }}>{error}</div>
          )}
        </div>

        <div className="edit-modal-foot">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Entry will appear in the talent pool immediately.
          </span>
          <div className="cluster">
            <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Adding..." : "Add to pool"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function initialsFor(name = "") {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TP";
}

function Section({ title, children }) {
  return (
    <div className="profile-section">
      <div className="mono eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function TalentField({ label, children }) {
  return (
    <label className="inbox-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function KVTalent({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}>
      <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{k}</span>
      <span style={{ fontSize: 13, textAlign: "right" }}>{v || <em style={{ color: "var(--muted)", fontStyle: "normal" }}>-</em>}</span>
    </div>
  );
}

window.TalentPoolView = TalentPoolView;
