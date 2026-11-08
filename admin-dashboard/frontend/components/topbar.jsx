function Topbar({
  view,
  onLogout,
  loggingOut,
  notifications = [],
  notificationSummary = {},
  onMarkNotificationRead,
  onDeleteNotification,
  settings,
  messages = [],
  messageSummary = {},
  positions = [],
  onMessagesChanged,
  onNotificationsOpenChange,
  onMessagesOpenChange,
  onMessageModalOpenChange
}) {
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [messagesOpen, setMessagesOpen] = React.useState(false);
  const [activeMessage, setActiveMessage] = React.useState(null);
  const labels = {
    dashboard:    "Dashboard",
    employers:    "Employers",
    requisitions: "Requisitions",
    positions:    "Positions",
    applicants:   "Applicants",
    screening:    "Screening",
    shortlist:    "Shortlist",
    interviews:   "Interviews",
    offers:       "Offers",
    talent:       "Talent Pool",
    reports:      "Reports",
    settings:     "Accounts",
  };
  const notificationCount = React.useMemo(
    () => Number(notificationSummary.unread || notifications.filter((item) => item.status === "unread").length || 0),
    [notificationSummary.unread, notifications]
  );
  const quickNotification = React.useMemo(
    () => notifications.find((item) => item.status === "unread") || notifications[0] || null,
    [notifications]
  );
  const unreadMessageCount = React.useMemo(
    () => Number(messageSummary.unread || messages.filter((item) => item.status === "unread").length || 0),
    [messageSummary.unread, messages]
  );
  const visibleMessages = React.useMemo(
    () => messages.filter((item) => item.status !== "archived").slice(0, 8),
    [messages]
  );
  const accountSettings = settings?.accountSettings || {};
  const profile = settings?.profile || {};
  const displayName = accountSettings.fullName || profile.displayName || profile.username || "Dashboard Admin";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DA";

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (activeMessage) {
        setActiveMessage(null);
        return;
      }
      setNotificationsOpen(false);
      setMessagesOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMessage]);

  React.useEffect(() => {
    if (onNotificationsOpenChange) onNotificationsOpenChange(notificationsOpen);
  }, [notificationsOpen, onNotificationsOpenChange]);

  React.useEffect(() => {
    if (onMessagesOpenChange) onMessagesOpenChange(messagesOpen);
  }, [messagesOpen, onMessagesOpenChange]);

  React.useEffect(() => {
    if (onMessageModalOpenChange) onMessageModalOpenChange(Boolean(activeMessage));
  }, [activeMessage, onMessageModalOpenChange]);

  const openMessage = React.useCallback(async (message) => {
    setActiveMessage(message);
    setMessagesOpen(false);
    setNotificationsOpen(false);
    if (message.status !== "unread") return;

    try {
      const response = await window.HEYA_API.markMessageRead(message.id);
      if (response.message) setActiveMessage(response.message);
      if (onMessagesChanged) await onMessagesChanged();
    } catch (err) {
      console.warn("Unable to mark inbox message as read.", err);
    }
  }, [onMessagesChanged]);

  function replaceActiveMessage(message) {
    if (message) setActiveMessage(message);
  }

  const markNotificationRead = React.useCallback(async (item) => {
    if (!item || !onMarkNotificationRead) return;
    await onMarkNotificationRead(item.id);
  }, [onMarkNotificationRead]);

  const deleteNotification = React.useCallback(async (item) => {
    if (!item || !onDeleteNotification) return;
    if (!window.confirm(`Delete notification "${item.title || "this notification"}"?`)) return;
    await onDeleteNotification(item.id);
  }, [onDeleteNotification]);

  return (
    <header className="topbar">
      <div className="crumbs">HEYA <span style={{ margin: "0 6px", color: "var(--muted-2)" }}>/</span> <b>{labels[view] || ""}</b></div>
      <div className="searchbar" style={{ marginLeft: 16 }}>
        <I.Search />
        <input placeholder="Search positions, applicants, notes..." />
        <span className="kbd">CMD K</span>
      </div>
      <div className="topbar-actions">
        <div className="topbar-profile">
          <div className="avatar tone-c topbar-profile__avatar">
            {(accountSettings.avatarUrl || profile.avatarUrl) ? <img src={accountSettings.avatarUrl || profile.avatarUrl} alt={displayName} /> : initials}
          </div>
        </div>

        <div className="notifications-wrap inbox-wrap">
          <button className="icon-btn notifications-btn" title="Inbox messages" onClick={() => {
            setMessagesOpen((value) => !value);
            setNotificationsOpen(false);
          }}>
            <I.Mail />
            {unreadMessageCount > 0 && <sup className="notif-count">{unreadMessageCount > 9 ? "9+" : unreadMessageCount}</sup>}
          </button>
          {messagesOpen && (
            <>
              <div className="menu-scrim" onClick={() => setMessagesOpen(false)} />
              <div className="notifications-menu inbox-menu">
                <div className="notifications-menu__head">
                  <div style={{ fontWeight: 600 }}>Inbox</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{unreadMessageCount} unread</div>
                </div>
                {visibleMessages.length === 0 && (
                  <div className="notifications-empty">No application or CV messages yet.</div>
                )}
                {visibleMessages.map((item) => (
                  <button key={item.id} className={"inbox-item " + (item.status === "unread" ? "is-unread" : "")} onClick={() => openMessage(item)}>
                    <span className={"notifications-item__pill notifications-item__pill--" + (item.status === "unread" ? "urgent" : "info")}></span>
                    <span>
                      <span className="inbox-item__title">{item.subject || "New message"}</span>
                      <span className="inbox-item__detail">{item.name} - {item.email || "no email"}</span>
                      <span className="inbox-item__meta">{item.receivedAt || item.createdAt}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="notifications-wrap">
          <div className="notification-hover-target">
            <button className="icon-btn notifications-btn" title="Notifications" onClick={() => {
              setNotificationsOpen((value) => !value);
              setMessagesOpen(false);
            }}>
              <I.Bell />
              {notificationCount > 0 && <sup className="notif-count">{notificationCount > 9 ? "9+" : notificationCount}</sup>}
            </button>
            {quickNotification && (
              <div className="notification-quick-actions">
                <button onClick={(event) => { event.stopPropagation(); markNotificationRead(quickNotification); }}>Mark as read</button>
                <button onClick={(event) => { event.stopPropagation(); deleteNotification(quickNotification); }}>Delete</button>
              </div>
            )}
          </div>
          {notificationsOpen && (
            <>
              <div className="menu-scrim" onClick={() => setNotificationsOpen(false)} />
              <div className="notifications-menu">
                <div className="notifications-menu__head">
                  <div style={{ fontWeight: 600 }}>Notifications</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{notificationCount} unread</div>
                </div>
                {notifications.length === 0 && (
                  <div className="notifications-empty">No new dashboard notifications.</div>
                )}
                {notifications.map((item) => (
                  <div key={item.id} className={"notifications-item " + (item.status === "read" ? "is-read" : "")}>
                    <span className={"notifications-item__pill notifications-item__pill--" + (item.status === "unread" ? (item.tone || "info") : "read")}></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="notifications-item__title">{item.title}</div>
                      <div className="notifications-item__detail">{item.detail}</div>
                      <div className="notifications-item__actions">
                        <button onClick={() => markNotificationRead(item)} disabled={item.status === "read"}>Mark as read</button>
                        <button onClick={() => deleteNotification(item)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <button className="btn ghost sm" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>

      {activeMessage && (
        <InboxMessageModal
          message={activeMessage}
          positions={positions}
          onClose={() => setActiveMessage(null)}
          onMessageUpdate={replaceActiveMessage}
          onMessagesChanged={onMessagesChanged}
        />
      )}
    </header>
  );
}

function InboxMessageModal({ message, positions = [], onClose, onMessageUpdate, onMessagesChanged }) {
  const openPositions = React.useMemo(
    () => positions.filter((position) => position.status === "published"),
    [positions]
  );
  const [talentDraft, setTalentDraft] = React.useState({
    title: message.desiredRoles || message.subject || "",
    location: message.currentLocation || "",
    skills: message.industries || "",
    yearsExperience: message.yearsExperience || ""
  });
  const [positionId, setPositionId] = React.useState(message.positionId || (openPositions[0]?.id || ""));
  const [busy, setBusy] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setTalentDraft({
      title: message.desiredRoles || message.subject || "",
      location: message.currentLocation || "",
      skills: message.industries || "",
      yearsExperience: message.yearsExperience || ""
    });
    setPositionId(message.positionId || (openPositions[0]?.id || ""));
    setNotice("");
    setError("");
  }, [message.id]);

  async function handleTalentPool() {
    setBusy("talent");
    setError("");
    setNotice("");
    try {
      const response = await window.HEYA_API.addMessageToTalentPool(message.id, {
        title: talentDraft.title,
        currentLocation: talentDraft.location,
        skills: talentDraft.skills,
        yearsExperience: talentDraft.yearsExperience,
        notes: message.body
      });
      if (response.message && onMessageUpdate) onMessageUpdate(response.message);
      setNotice("Added to the talent pool.");
      if (onMessagesChanged) await onMessagesChanged();
    } catch (err) {
      setError(err.message || "Unable to add this person to the talent pool.");
    } finally {
      setBusy("");
    }
  }

  async function handleAttachToJob() {
    if (!positionId) {
      setError("Choose a published job advert first.");
      return;
    }
    setBusy("job");
    setError("");
    setNotice("");
    try {
      const response = await window.HEYA_API.attachMessageToJob(message.id, {
        positionId,
        currentLocation: talentDraft.location,
        yearsExperience: talentDraft.yearsExperience,
        notes: message.body
      });
      if (response.message && onMessageUpdate) onMessageUpdate(response.message);
      setNotice("Attached as an application.");
      if (onMessagesChanged) await onMessagesChanged();
    } catch (err) {
      setError(err.message || "Unable to attach this application.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="publish-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="edit-modal inbox-modal">
        <div className="edit-modal-head">
          <div>
            <div className="mono eyebrow">Message reading form</div>
            <div className="edit-modal-title">{message.subject || "Inbox message"}</div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">x</button>
        </div>
        <div className="edit-modal-body">
          <div className="inbox-modal-grid">
            <div className="stack" style={{ gap: 12 }}>
              <div className="inbox-read-card">
                <div className="mono eyebrow">Sender</div>
                <div className="inbox-read-card__name">{message.name}</div>
                <div className="inbox-read-card__line">{message.email || "No email provided"}</div>
                <div className="inbox-read-card__line">{message.phone || "No phone provided"}</div>
              </div>
              <InboxField label="Message">
                <textarea className="ifield" rows="10" value={message.body || ""} readOnly />
              </InboxField>
              <div className="cluster">
                {message.cvFile?.downloadUrl && <a className="btn accent sm" href={message.cvFile.downloadUrl} target="_blank" rel="noreferrer">Download CV</a>}
                {message.coverLetterFile?.downloadUrl && <a className="btn ghost sm" href={message.coverLetterFile.downloadUrl} target="_blank" rel="noreferrer">Cover letter</a>}
              </div>
            </div>

            <div className="stack" style={{ gap: 12 }}>
              <div className="inbox-link-status">
                <div>
                  <div className="mono eyebrow">Inbox state</div>
                  <div className="inbox-link-status__title">{message.status === "unread" ? "Unread" : "Read"}</div>
                </div>
                <span className="status-badge status-ready">{message.kind}</span>
              </div>

              {(message.linkedTalent || message.linkedApplicant) && (
                <div className="hint-box">
                  {message.linkedTalent && <div>Talent pool: {message.linkedTalent.name}</div>}
                  {message.linkedApplicant && <div>Application: {message.linkedApplicant.name} - {message.linkedApplicant.positionTitle}</div>}
                </div>
              )}

              <div className="inbox-action-panel">
                <div className="mono eyebrow">Add to talent pool</div>
                <InboxField label="Talent title / desired roles">
                  <input className="ifield" value={talentDraft.title} onChange={(e) => setTalentDraft({ ...talentDraft, title: e.target.value })} />
                </InboxField>
                <InboxField label="Location">
                  <input className="ifield" value={talentDraft.location} onChange={(e) => setTalentDraft({ ...talentDraft, location: e.target.value })} />
                </InboxField>
                <InboxField label="Industries / skills">
                  <input className="ifield" value={talentDraft.skills} onChange={(e) => setTalentDraft({ ...talentDraft, skills: e.target.value })} />
                </InboxField>
                <InboxField label="Experience">
                  <input className="ifield" value={talentDraft.yearsExperience} onChange={(e) => setTalentDraft({ ...talentDraft, yearsExperience: e.target.value })} />
                </InboxField>
                <button className="btn accent sm" onClick={handleTalentPool} disabled={busy === "talent"}>
                  {busy === "talent" ? "Adding..." : message.linkedTalent ? "Update talent link" : "Add to talent pool"}
                </button>
              </div>

              <div className="inbox-action-panel">
                <div className="mono eyebrow">Attach to open job advert</div>
                <select className="ifield" value={positionId} onChange={(e) => setPositionId(e.target.value)} disabled={openPositions.length === 0}>
                  {openPositions.length === 0 && <option value="">No published job adverts</option>}
                  {openPositions.map((position) => (
                    <option key={position.id} value={position.id}>{position.title}</option>
                  ))}
                </select>
                <button className="btn primary sm" onClick={handleAttachToJob} disabled={busy === "job" || openPositions.length === 0}>
                  {busy === "job" ? "Attaching..." : message.linkedApplicant ? "Update application link" : "Attach application"}
                </button>
              </div>

              {(notice || error) && (
                <div className={"inbox-action-status " + (error ? "is-error" : "is-success")}>
                  {error || notice}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="edit-modal-foot">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Received {message.receivedAt || message.createdAt || "recently"}</span>
          <div className="cluster">
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxField({ label, children }) {
  return (
    <label className="inbox-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

window.Topbar = Topbar;
