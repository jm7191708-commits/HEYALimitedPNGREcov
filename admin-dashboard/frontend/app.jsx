const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "orange",
  "density": "balanced",
  "fontDisplay": "Instrument Serif",
  "showAI": true
}/*EDITMODE-END*/;

const DEFAULT_REFRESH_INTERVAL_MS = 30000;
const REFRESH_WHEN_HIDDEN_MULTIPLIER = 4;
const DEFAULT_MESSAGE_SUMMARY = { total: 0, unread: 0, archived: 0, applications: 0, byKind: {} };
const DEFAULT_NOTIFICATION_SUMMARY = { total: 0, unread: 0, read: 0 };

function getRecordLatestTimestamp(record) {
  if (!record || typeof record !== "object") return 0;

  const timestampFields = [
    "updatedAt",
    "updated_at",
    "lastUpdated",
    "last_updated",
    "submittedAt",
    "submitted_at",
    "appliedAt",
    "applied_at",
    "receivedAt",
    "received_at",
    "createdAt",
    "created_at",
    "lastTouchpoint"
  ];

  return timestampFields.reduce((latest, field) => {
    const value = record[field];
    if (!value) return latest;
    const next = new Date(value).getTime();
    if (Number.isNaN(next)) return latest;
    return Math.max(latest, next);
  }, 0);
}

function getCollectionLatestTimestamp(items) {
  const latest = (items || []).reduce((max, item) => Math.max(max, getRecordLatestTimestamp(item)), 0);
  return latest ? new Date(latest).toISOString() : null;
}

function getDashboardLatestTimestamp(collections) {
  const latest = (collections || []).reduce((max, items) => {
    return Math.max(max, (items || []).reduce((inner, item) => Math.max(inner, getRecordLatestTimestamp(item)), 0));
  }, 0);
  return latest ? new Date(latest).toISOString() : null;
}

function mergeNewestById(existing, incoming) {
  const fresh = Array.isArray(incoming) ? incoming.filter(Boolean) : [];
  if (!fresh.length) return existing;
  const seen = new Set(fresh.map((item) => item.id));
  return [...fresh, ...(existing || []).filter((item) => !seen.has(item.id))];
}

function isPendingOfferApplicant(applicant) {
  return applicant?.offerStatus === "pending";
}

function App() {
  const [tweaks, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];
  const [view, setView] = React.useState("dashboard");
  const [positions, setPositions] = React.useState([]);
  const [applicants, setApplicants] = React.useState([]);
  const [talentPool, setTalentPool] = React.useState([]);
  const [employerSubmissions, setEmployerSubmissions] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [messageSummary, setMessageSummary] = React.useState(DEFAULT_MESSAGE_SUMMARY);
  const [dashboardNotifications, setDashboardNotifications] = React.useState([]);
  const [notificationSummary, setNotificationSummary] = React.useState(DEFAULT_NOTIFICATION_SUMMARY);
  const [settings, setSettings] = React.useState(null);
  const [activePositionId, setActivePositionId] = React.useState(null);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = React.useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [messagesOpen, setMessagesOpen] = React.useState(false);
  const [messageModalOpen, setMessageModalOpen] = React.useState(false);
  const [applicantsBusy, setApplicantsBusy] = React.useState(false);
  const [talentBusy, setTalentBusy] = React.useState(false);
  const [requisitionsBusy, setRequisitionsBusy] = React.useState(false);
  const [positionsBusy, setPositionsBusy] = React.useState(false);
  const [pendingApplicantItems, setPendingApplicantItems] = React.useState([]);
  const [pendingTalentItems, setPendingTalentItems] = React.useState([]);
  const refreshLockRef = React.useRef(false);
  const refreshMetaRef = React.useRef({
    notificationsLatest: null,
    messagesLatest: null,
    employerLatest: null,
    applicationsLatest: null,
    talentLatest: null,
    dashboardLatest: null
  });
  const applyDashboardPayload = React.useCallback((data) => {
    setPositions(data.positions || []);
    setApplicants(data.applicants || []);
    setTalentPool(data.talentPool || []);
    setEmployerSubmissions(data.employerSubmissions || []);
  }, []);

  const loadDashboard = React.useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const data = await window.HEYA_API.getDashboardData({ includeNotifications: false });
      applyDashboardPayload(data);
      return data;
    } catch (err) {
      setError(err.message || "Unable to load dashboard data.");
      throw err;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [applyDashboardPayload]);

  const loadMessages = React.useCallback(async () => {
    try {
      const data = await window.HEYA_API.getRecentMessages(8);
      setMessages(data.messages || []);
      setMessageSummary(data.summary || DEFAULT_MESSAGE_SUMMARY);
      return data;
    } catch (err) {
      console.warn("Unable to load dashboard inbox.", err);
      throw err;
    }
  }, []);

  const loadNotifications = React.useCallback(async () => {
    try {
      const data = await window.HEYA_API.getRecentNotifications(10);
      setDashboardNotifications(data.notifications || []);
      setNotificationSummary(data.summary || DEFAULT_NOTIFICATION_SUMMARY);
      return data;
    } catch (err) {
      console.warn("Unable to load dashboard notifications.", err);
      throw err;
    }
  }, []);

  const loadInitialData = React.useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      window.HEYA_API.getDashboardData({ includeNotifications: false }),
      window.HEYA_API.getSettings(),
      window.HEYA_API.getRecentMessages(8),
      window.HEYA_API.getRecentNotifications(10),
      window.HEYA_API.getRefreshConfig()
    ]);

    const [dashboardResult, settingsResult, messagesResult, notificationsResult, refreshConfigResult] = results;

    if (dashboardResult.status === "fulfilled") {
      applyDashboardPayload(dashboardResult.value);
    } else {
      setError(dashboardResult.reason?.message || "Unable to load dashboard data.");
    }

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value.settings || null);
    } else {
      console.warn("Unable to load dashboard settings.", settingsResult.reason);
    }

    if (messagesResult.status === "fulfilled") {
      setMessages(messagesResult.value.messages || []);
      setMessageSummary(messagesResult.value.summary || DEFAULT_MESSAGE_SUMMARY);
    } else {
      console.warn("Unable to load dashboard inbox.", messagesResult.reason);
    }

    if (notificationsResult.status === "fulfilled") {
      setDashboardNotifications(notificationsResult.value.notifications || []);
      setNotificationSummary(notificationsResult.value.summary || DEFAULT_NOTIFICATION_SUMMARY);
    } else {
      console.warn("Unable to load dashboard notifications.", notificationsResult.reason);
    }

    if (refreshConfigResult.status === "fulfilled") {
      if (Number.isFinite(refreshConfigResult.value.intervalMs) && refreshConfigResult.value.intervalMs >= 5000) {
        setRefreshIntervalMs(refreshConfigResult.value.intervalMs);
      }
    } else {
      console.warn("Unable to load dashboard refresh config.", refreshConfigResult.reason);
    }

    setLoading(false);
  }, [applyDashboardPayload]);

  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  React.useEffect(() => {
    if (!settings) return;
    const displayPreferences = settings.accountSettings?.displayPreferences || settings.preferences || {};
    if (displayPreferences.defaultView) {
      setView((current) => (current === "dashboard" ? displayPreferences.defaultView : current));
    }
    if (displayPreferences.accent) {
      setTweak("accent", displayPreferences.accent);
    }
    if (displayPreferences.density) {
      setTweak("density", displayPreferences.density);
    }
    if (typeof settings.plugins?.aiAssistant === "boolean") {
      setTweak("showAI", settings.plugins.aiAssistant);
    }
    // Pipedrive middleware gate — readable by applicants.jsx without prop drilling
    window.HEYA_PD_ENABLED = Boolean(settings.plugins?.customerCrm);
  }, [settings, setTweak]);

  React.useEffect(() => {
    document.documentElement.dataset.accent = tweaks.accent || "orange";
    document.documentElement.dataset.density = tweaks.density || "balanced";
  }, [tweaks]);

  React.useEffect(() => {
    const keepsPositionScope = ["positions", "applicants", "screening", "interviews", "offers", "requisitions"].includes(view);
    if (!keepsPositionScope) setActivePositionId(null);
  }, [view]);

  React.useEffect(() => {
    refreshMetaRef.current.notificationsLatest = getCollectionLatestTimestamp(dashboardNotifications);
  }, [dashboardNotifications]);

  React.useEffect(() => {
    refreshMetaRef.current.messagesLatest = getCollectionLatestTimestamp(messages);
  }, [messages]);

  React.useEffect(() => {
    refreshMetaRef.current.employerLatest = getCollectionLatestTimestamp(employerSubmissions);
  }, [employerSubmissions]);

  React.useEffect(() => {
    refreshMetaRef.current.applicationsLatest = getCollectionLatestTimestamp(applicants);
  }, [applicants]);

  React.useEffect(() => {
    refreshMetaRef.current.talentLatest = getCollectionLatestTimestamp(talentPool);
  }, [talentPool]);

  React.useEffect(() => {
    refreshMetaRef.current.dashboardLatest = getDashboardLatestTimestamp([
      dashboardNotifications,
      messages,
      employerSubmissions,
      applicants,
      talentPool
    ]);
  }, [dashboardNotifications, messages, employerSubmissions, applicants, talentPool]);

  async function savePosition(position) {
    const response = position.id && String(position.id).startsWith("pos-")
      ? await window.HEYA_API.createPosition(position)
      : position.id
        ? await window.HEYA_API.updatePosition(position.id, position)
        : await window.HEYA_API.createPosition(position);
    await loadDashboard();
    return response.posting;
  }

  async function setPositionStatus(positionId, status) {
    await window.HEYA_API.setPositionStatus(positionId, status);
    await loadDashboard();
  }

  async function savePositionKpiCriteria(positionId, payload) {
    const response = await window.HEYA_API.savePositionKpiCriteria(positionId, payload);
    if (response.position) {
      setPositions((current) => current.map((item) => String(item.id) === String(response.position.id) ? response.position : item));
    }
    return response.screening;
  }

  async function deletePosition(positionId) {
    await window.HEYA_API.deletePosition(positionId);
    // Immediately remove from local state so the UI transitions cleanly
    // before the background reload finishes — avoids the "Position not found" flash.
    setPositions((current) => current.filter((p) => String(p.id) !== String(positionId)));
    setApplicants((current) => current.filter((a) => String(a.positionId) !== String(positionId)));
    // Reload in background (no loading overlay) to sync any other server-side changes.
    loadDashboard(false).catch(console.error);
  }

  async function updateApplicantStatus(applicantId, status) {
    const response = await window.HEYA_API.updateApplicantStatus(applicantId, status);
    if (response.application) {
      setApplicants((current) => current.map((item) => String(item.id) === String(response.application.id) ? response.application : item));
    }
    return response.application;
  }

  async function saveApplicantScreeningRecord(applicantId, payload) {
    const response = await window.HEYA_API.saveApplicantScreening(applicantId, payload);
    if (response.application) {
      setApplicants((current) => current.map((item) => String(item.id) === String(response.application.id) ? response.application : item));
    }
    return response.application;
  }

  async function saveApplicantShortlistReview(applicantId, payload) {
    const response = await window.HEYA_API.saveApplicantShortlistReview(applicantId, payload);
    if (response.application) {
      setApplicants((current) => current.map((item) => String(item.id) === String(response.application.id) ? response.application : item));
    }
    return response.application;
  }

  async function deleteApplication(applicantId, { includePipedrive = false } = {}) {
    if (includePipedrive) {
      await window.HEYA_API.deleteApplicationWithPipedrive(applicantId);
    } else {
      await window.HEYA_API.deleteApplication(applicantId);
    }
    await loadDashboard();
  }

  async function updateOfferStatus(applicationIds, status, reason = "") {
    const response = await window.HEYA_API.updateOfferStatus(applicationIds, status, reason);
    if (response.applications) {
      const updates = new Map(response.applications.map((item) => [item.id, item]));
      setApplicants((current) => current.map((item) => updates.get(item.id) || item));
    }
    return response.applications || [];
  }

  async function deleteOffers(applicationIds, reason = "") {
    const response = await window.HEYA_API.deleteOffers(applicationIds, reason);
    if (response.applications) {
      const updates = new Map(response.applications.map((item) => [item.id, item]));
      setApplicants((current) => current.map((item) => updates.get(item.id) || item));
    }
    return response.applications || [];
  }

  async function pushApplicantsForPositionToScreening(positionId, applicantOrder = []) {
    const selectedPosition = (positions || []).find((position) => String(position.id) === String(positionId));
    const fallbackOrder = Array.isArray(selectedPosition?.filtration?.order) ? selectedPosition.filtration.order : [];
    await window.HEYA_API.pushPositionToScreening(positionId, applicantOrder.length ? applicantOrder : fallbackOrder);
    await loadDashboard(false);
  }

  async function reloadScreeningWorkspace() {
    await Promise.allSettled([loadDashboard(false), loadNotifications()]);
  }

  async function deleteEmployerSubmission(submissionId) {
    await window.HEYA_API.deleteEmployerSubmission(submissionId);
    await Promise.allSettled([loadDashboard(false), loadNotifications()]);
  }

  async function bulkDeleteEmployerSubmissions(ids) {
    await window.HEYA_API.bulkDeleteEmployerSubmissions(ids);
    await Promise.allSettled([loadDashboard(false), loadNotifications()]);
  }

  async function addTalentPoolProfile(payload) {
    const response = await window.HEYA_API.createTalentPoolProfile(payload);
    await Promise.allSettled([loadDashboard(false), loadNotifications()]);
    return response.talent;
  }

  async function updateTalentPoolProfile(talentId, payload) {
    const response = await window.HEYA_API.updateTalentPoolProfile(talentId, payload);
    await loadDashboard(false);
    return response.talent;
  }

  async function deleteTalentPoolProfile(talentId) {
    await window.HEYA_API.deleteTalentPoolProfile(talentId);
    await Promise.allSettled([loadDashboard(false), loadNotifications()]);
  }

  async function bulkDeleteTalentPoolProfiles(ids) {
    await window.HEYA_API.bulkDeleteTalentPoolProfiles(ids);
    await Promise.allSettled([loadDashboard(false), loadNotifications()]);
  }

  async function saveSettings(nextSettings) {
    const response = await window.HEYA_API.updateSettings(nextSettings);
    setSettings(response.settings || nextSettings);
    return response.settings;
  }

  async function saveAccountSettings(accountPayload) {
    const response = await window.HEYA_API.updateAccountSettings(accountPayload);
    if (response.settings) {
      setSettings(response.settings);
      return response.settings.accountSettings || response.accountSettings;
    }
    setSettings((current) => current ? { ...current, accountSettings: response.accountSettings || accountPayload } : current);
    return response.accountSettings || accountPayload;
  }

  async function createDraftFromSubmission(submissionId) {
    const response = await window.HEYA_API.createDraftFromSubmission(submissionId);
    await loadDashboard();
    setView("requisitions");
    setTimeout(() => setActivePositionId(response.posting.id), 0);
  }

  async function refreshAfterMessageAction() {
    await Promise.allSettled([loadMessages(), loadNotifications(), loadDashboard(false)]);
  }

  async function markNotificationRead(notificationId) {
    await window.HEYA_API.markNotificationRead(notificationId);
    await loadNotifications();
  }

  async function deleteNotification(notificationId) {
    await window.HEYA_API.deleteNotification(notificationId);
    await loadNotifications();
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await window.HEYA_API.logout();
      window.location.href = response.redirectTo || "/dashboard/login";
    } catch (err) {
      setError(err.message || "Unable to log out.");
      setLoggingOut(false);
    }
  }

  async function refreshMessageCounts() {
    try {
      const data = messagesOpen && !messageModalOpen
        ? await window.HEYA_API.getRecentMessages(8)
        : await window.HEYA_API.getMessageUnreadCount();
      if (data.messages) {
        setMessages(data.messages || []);
      }
      setMessageSummary(data.summary || DEFAULT_MESSAGE_SUMMARY);
    } catch (err) {
      console.warn("Unable to refresh message counts.", err);
    }
  }

  async function refreshNotificationCounts() {
    try {
      const data = notificationsOpen
        ? await window.HEYA_API.getRecentNotifications(10)
        : await window.HEYA_API.getNotificationUnreadCount();
      if (data.notifications) {
        setDashboardNotifications(data.notifications || []);
      }
      setNotificationSummary(data.summary || DEFAULT_NOTIFICATION_SUMMARY);
    } catch (err) {
      console.warn("Unable to refresh notification counts.", err);
    }
  }

  async function refreshEmployerSubmissions() {
    const data = await window.HEYA_API.getEmployerSubmissionsRefresh(refreshMetaRef.current.employerLatest);
    if (!data.items?.length) return;
    setEmployerSubmissions((current) => mergeNewestById(current, data.items));
  }

  async function refreshApplicants() {
    const data = await window.HEYA_API.getApplicationsRefresh(refreshMetaRef.current.applicationsLatest);
    if (!data.items?.length) return;
    if (applicantsBusy) {
      setPendingApplicantItems((current) => mergeNewestById(current, data.items));
      return;
    }
    setApplicants((current) => mergeNewestById(current, data.items));
  }

  async function refreshTalentPoolEntries() {
    const data = await window.HEYA_API.getTalentPoolRefresh(refreshMetaRef.current.talentLatest);
    if (!data.items?.length) return;
    if (talentBusy) {
      setPendingTalentItems((current) => mergeNewestById(current, data.items));
      return;
    }
    setTalentPool((current) => mergeNewestById(current, data.items));
  }

  function applyPendingApplicants() {
    if (!pendingApplicantItems.length) return;
    setApplicants((current) => mergeNewestById(current, pendingApplicantItems));
    setPendingApplicantItems([]);
  }

  function applyPendingTalent() {
    if (!pendingTalentItems.length) return;
    setTalentPool((current) => mergeNewestById(current, pendingTalentItems));
    setPendingTalentItems([]);
  }

  React.useEffect(() => {
    if (loading) return undefined;

    let cancelled = false;
    let timer = null;

    const schedule = (immediate = false) => {
      if (cancelled) return;
      const baseDelay = document.hidden
        ? Math.max(refreshIntervalMs * REFRESH_WHEN_HIDDEN_MULTIPLIER, 60000)
        : refreshIntervalMs;
      timer = window.setTimeout(runRefresh, immediate ? 0 : baseDelay);
    };

    const runRefresh = async () => {
      if (cancelled || refreshLockRef.current) {
        schedule();
        return;
      }

      refreshLockRef.current = true;
      try {
        await Promise.allSettled([
          refreshNotificationCounts(),
          refreshMessageCounts()
        ]);

        const refreshApplicantsForView = ["dashboard", "reports", "positions", "screening", "applicants", "shortlist", "interviews", "offers"].includes(view);
        const refreshEmployersForView = ["dashboard", "reports", "employers"].includes(view);
        const refreshTalentForView = ["talent"].includes(view);
        const refreshTasks = [];

        if (refreshEmployersForView && !requisitionsBusy && !positionsBusy) {
          refreshTasks.push(refreshEmployerSubmissions());
        }
        if (refreshApplicantsForView && !requisitionsBusy) {
          refreshTasks.push(refreshApplicants());
        }
        if (refreshTalentForView && !requisitionsBusy) {
          refreshTasks.push(refreshTalentPoolEntries());
        }
        if (refreshTasks.length) {
          await Promise.allSettled(refreshTasks);
        }
      } finally {
        refreshLockRef.current = false;
        schedule();
      }
    };

    const onVisibilityChange = () => {
      if (timer) window.clearTimeout(timer);
      schedule(!document.hidden);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loading, view, refreshIntervalMs, notificationsOpen, messagesOpen, messageModalOpen, applicantsBusy, talentBusy, requisitionsBusy, positionsBusy]);

  const counts = React.useMemo(() => ({
    employers: employerSubmissions.filter((item) => item.status !== "converted").length,
    requisitions: positions.filter((p) => p.status === "draft" || p.status === "ready").length,
    positions: positions.filter((p) => p.status === "published").length,
    applicants: applicants.length,
    screening: positions.filter((p) => p.status === "screening").length,
    shortlist: applicants.filter((a) => a.status === "shortlisted").length,
    interviews: applicants.filter((a) => a.status === "interview").length,
    offers: applicants.filter((a) => isPendingOfferApplicant(a)).length,
  }), [employerSubmissions, positions, applicants]);

  let body;
  if (loading) {
    body = <div className="page"><div className="card" style={{ padding: 28 }}>Loading careers dashboard...</div></div>;
  } else if (error) {
    body = <div className="page"><div className="card" style={{ padding: 28, color: "var(--danger)" }}>{error}</div></div>;
  } else {
    switch (view) {
      case "dashboard":
        body = <Dashboard positions={positions} applicants={applicants} settings={settings} setView={setView} setActivePositionId={setActivePositionId} />;
        break;
      case "employers":
        body = <EmployerSubmissions submissions={employerSubmissions} onCreateDraft={createDraftFromSubmission} onDelete={deleteEmployerSubmission} onBulkDelete={bulkDeleteEmployerSubmissions} />;
        break;
      case "requisitions":
        body = <Requisitions positions={positions} activePositionId={activePositionId} setActivePositionId={setActivePositionId} setView={setView} onSavePosition={savePosition} onDeletePosition={deletePosition} onEditingChange={setRequisitionsBusy} />;
        break;
      case "positions":
        body = <Positions positions={positions} applicants={applicants} activePositionId={activePositionId} setActivePositionId={setActivePositionId} setView={setView} setPositions={setPositions} pushToScreening={pushApplicantsForPositionToScreening} onSavePosition={savePosition} onSetPositionStatus={setPositionStatus} onDeletePosition={deletePosition} onEditingChange={setPositionsBusy} />;
        break;
      case "screening":
        body = <Screening positions={positions} setPositions={setPositions} applicants={applicants} setApplicants={setApplicants} activePositionId={activePositionId} setActivePositionId={setActivePositionId} onSavePositionKpiCriteria={savePositionKpiCriteria} onSaveApplicantScreening={saveApplicantScreeningRecord} onUpdateApplicantStatus={updateApplicantStatus} onDeletePosition={deletePosition} onEditingChange={setApplicantsBusy} onReloadDashboard={reloadScreeningWorkspace} />;
        break;
      case "applicants":
        body = <Applicants positions={positions} applicants={applicants} activePositionId={activePositionId} setActivePositionId={setActivePositionId} setView={setView} setPositions={setPositions} setApplicants={setApplicants} onPushApplicantsToScreening={pushApplicantsForPositionToScreening} onUpdateApplicantStatus={updateApplicantStatus} onSaveShortlistReview={saveApplicantShortlistReview} onDeleteApplication={deleteApplication} onEditingChange={setApplicantsBusy} pendingRefreshCount={pendingApplicantItems.length} onApplyPendingRefresh={applyPendingApplicants} />;
        break;
      case "shortlist":
        body = <Applicants positions={positions} applicants={applicants} onUpdateApplicantStatus={updateApplicantStatus} onSaveShortlistReview={saveApplicantShortlistReview} onDeleteApplication={deleteApplication} statusFilter="shortlisted" title="Shortlist" subtitle="Candidates moved forward from initial review." onEditingChange={setApplicantsBusy} pendingRefreshCount={pendingApplicantItems.length} onApplyPendingRefresh={applyPendingApplicants} />;
        break;
      case "interviews":
        body = <Applicants positions={positions} applicants={applicants} activePositionId={activePositionId} setActivePositionId={setActivePositionId} setView={setView} onUpdateApplicantStatus={updateApplicantStatus} onSaveShortlistReview={saveApplicantShortlistReview} onDeleteApplication={deleteApplication} statusFilter="interview" title="Interviews" subtitle="Direct interview review under Positions for candidates already moved into interview loops." onEditingChange={setApplicantsBusy} pendingRefreshCount={pendingApplicantItems.length} onApplyPendingRefresh={applyPendingApplicants} />;
        break;
      case "offers":
        body = <OffersView applicants={applicants} positions={positions} activePositionId={activePositionId} setActivePositionId={setActivePositionId} setView={setView} onUpdateOfferStatus={updateOfferStatus} onDeleteOffers={deleteOffers} />;
        break;
      case "talent":
        body = <TalentPoolView talents={talentPool} positions={positions} onAdd={addTalentPoolProfile} onUpdate={updateTalentPoolProfile} onDelete={deleteTalentPoolProfile} onBulkDelete={bulkDeleteTalentPoolProfiles} onEditingChange={setTalentBusy} pendingRefreshCount={pendingTalentItems.length} onApplyPendingRefresh={applyPendingTalent} />;
        break;
      case "reports":
        body = <ReportsView positions={positions} applicants={applicants} />;
        break;
      case "settings":
        body = <SettingsView settings={settings} onSaveSettings={saveSettings} onSaveAccountSettings={saveAccountSettings} />;
        break;
      default:
        body = <Dashboard positions={positions} applicants={applicants} setView={setView} setActivePositionId={setActivePositionId} />;
    }
  }

  return (
    <div className="app" data-screen-label={"App / " + view}>
      <Sidebar view={view} setView={setView} counts={counts} settings={settings} />
      <div className="main">
        <Topbar
          view={view}
          onLogout={logout}
          loggingOut={loggingOut}
          notifications={dashboardNotifications}
          notificationSummary={notificationSummary}
          onMarkNotificationRead={markNotificationRead}
          onDeleteNotification={deleteNotification}
          settings={settings}
          messages={messages}
          messageSummary={messageSummary}
          positions={positions}
          onMessagesChanged={refreshAfterMessageAction}
          onNotificationsOpenChange={setNotificationsOpen}
          onMessagesOpenChange={setMessagesOpen}
          onMessageModalOpenChange={setMessageModalOpen}
        />
        {body}
      </div>

      {tweaks.showAI && (
        aiOpen
          ? <AIPanel open={true} onClose={() => setAiOpen(false)} role={{ id: "recruiter", label: "Recruiter" }} />
          : <button className="ai-fab" onClick={() => setAiOpen(true)} title="roxanneAI">
              <span className="pulse"></span>
              <img src="/dashboard-assets/assets/roxanne-ai-logo.png" alt="" />
            </button>
      )}

      {window.TweaksPanel && settings?.plugins?.tweaksPanel !== false && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection title="Brand accent">
            <window.TweakRadio label="Primary accent" value={tweaks.accent} onChange={(v) => setTweak("accent", v)}
              options={[{ value: "orange", label: "Orange" }, { value: "gold", label: "Gold" }]} />
          </window.TweakSection>
          <window.TweakSection title="Density">
            <window.TweakRadio value={tweaks.density} onChange={(v) => setTweak("density", v)}
              options={[{ value: "balanced", label: "Balanced" }, { value: "dense", label: "Dense" }]} />
          </window.TweakSection>
          <window.TweakSection title="AI Assistant">
            <window.TweakToggle label="Show floating AI button" value={tweaks.showAI} onChange={(v) => setTweak("showAI", v)} />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
