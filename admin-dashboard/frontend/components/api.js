window.HEYA_API = {
  buildLoginRedirect(redirectTo) {
    const next = encodeURIComponent(window.location.pathname || "/dashboard/");
    const base = redirectTo || "/dashboard-access/login-disabled";
    return base.includes("?") ? `${base}&next=${next}` : `${base}?next=${next}`;
  },

  async request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const raw = await response.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    if (!data) {
      if (response.redirected && response.url && response.url.includes("/dashboard-access/")) {
        window.location.href = this.buildLoginRedirect(response.url);
        throw new Error("Dashboard authentication required.");
      }
      const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 180);
      throw new Error(snippet ? `Invalid server response: ${snippet}` : "Invalid server response.");
    }

    if (!response.ok || data.ok === false) {
      if (response.status === 401 && data.redirectTo) {
        window.location.href = this.buildLoginRedirect(data.redirectTo);
      }
      throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }
    return data;
  },

  async logout() {
    return this.request("/api/dashboard/auth/logout", {
      method: "POST"
    });
  },

  getRefreshConfig() {
    return this.request("/api/admin/dashboard/refresh-config");
  },

  getDashboardData(options = {}) {
    const params = new URLSearchParams();
    if (typeof options.includeNotifications === "boolean") {
      params.set("includeNotifications", String(options.includeNotifications));
    }
    if (Number.isInteger(options.notificationsLimit)) {
      params.set("notificationsLimit", String(options.notificationsLimit));
    }
    if (Number.isInteger(options.applicationsLimit)) {
      params.set("applicationsLimit", String(options.applicationsLimit));
    }
    if (Number.isInteger(options.employerSubmissionsLimit)) {
      params.set("employerSubmissionsLimit", String(options.employerSubmissionsLimit));
    }
    if (Number.isInteger(options.talentPoolLimit)) {
      params.set("talentPoolLimit", String(options.talentPoolLimit));
    }
    const query = params.toString();
    return this.request(`/api/admin/careers/dashboard${query ? `?${query}` : ""}`);
  },

  getOffers(status = "all") {
    const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/api/admin/careers/offers${query}`);
  },

  parseJobDocument(payload) {
    return this.request("/api/admin/careers/parse-jd", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  createPosition(payload) {
    return this.request("/api/admin/careers/job-postings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updatePosition(id, payload) {
    return this.request(`/api/admin/careers/job-postings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  uploadPositionImage(id, field, upload) {
    return this.request(`/api/admin/careers/job-postings/${encodeURIComponent(id)}/upload-image`, {
      method: "POST",
      body: JSON.stringify({ field, upload })
    });
  },

  savePositionKpiCriteria(id, payload) {
    return this.request(`/api/admin/careers/job-postings/${encodeURIComponent(id)}/kpi-criteria`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deletePosition(id) {
    return this.request(`/api/admin/careers/job-postings/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  setPositionStatus(id, status) {
    return this.request(`/api/admin/careers/job-postings/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
  },

  pushPositionToScreening(id, applicantOrder = []) {
    return this.request(`/api/admin/careers/job-postings/${encodeURIComponent(id)}/push-to-screening`, {
      method: "POST",
      body: JSON.stringify({ applicantOrder })
    });
  },

  updateApplicantStatus(id, status) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  updateOfferStatus(applicationIds, status, reason = "") {
    return this.request("/api/admin/careers/offers/status", {
      method: "PATCH",
      body: JSON.stringify({ applicationIds, status, reason })
    });
  },

  deleteOffers(applicationIds, reason = "") {
    return this.request("/api/admin/careers/offers", {
      method: "DELETE",
      body: JSON.stringify({ applicationIds, reason })
    });
  },

  saveApplicantScreening(id, payload) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/screening`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  saveApplicantShortlistReview(id, payload) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/shortlist-review`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  getScreenings(positionId) {
    const query = positionId ? `?positionId=${encodeURIComponent(positionId)}` : "";
    return this.request(`/api/admin/screenings${query}`);
  },

  sortScreenings(payload) {
    return this.request("/api/admin/screenings/sort", {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  getScreeningTieBreakers(positionId) {
    const query = positionId ? `?positionId=${encodeURIComponent(positionId)}` : "";
    return this.request(`/api/admin/screenings/tie-breakers${query}`);
  },

  createScreeningTieBreaker(payload) {
    return this.request("/api/admin/screenings/tie-breakers", {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  updateScreeningTieBreakerCriteria(id, payload) {
    return this.request(`/api/admin/screenings/tie-breakers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload || {})
    });
  },

  saveScreeningTieBreaker(applicationId, payload) {
    return this.request(`/api/admin/screenings/${encodeURIComponent(applicationId)}/tie-breaker`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  sortScreeningsWithTieBreaker(payload) {
    return this.request("/api/admin/screenings/sort-with-tie-breaker", {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  pushScreeningsToShortlist(payload) {
    return this.request("/api/admin/screenings/push-to-shortlist", {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  getShortlisted(positionId) {
    const query = positionId ? `?positionId=${encodeURIComponent(positionId)}` : "";
    return this.request(`/api/admin/shortlisted${query}`);
  },

  getPositionShortlistingCriteria(positionId) {
    return this.request(`/api/admin/positions/${encodeURIComponent(positionId)}/shortlisting-criteria`);
  },

  createPositionShortlistingCriteria(positionId, payload) {
    return this.request(`/api/admin/positions/${encodeURIComponent(positionId)}/shortlisting-criteria`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  runPositionShortlisting(positionId, payload) {
    return this.request(`/api/admin/positions/${encodeURIComponent(positionId)}/run-shortlisting`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  pushToShortlist(positionId, payload) {
    return this.request(`/api/admin/positions/${encodeURIComponent(positionId)}/push-to-shortlist`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  moveShortlistedToInterview(applicationId) {
    return this.request(`/api/admin/shortlisted/${encodeURIComponent(applicationId)}/move-to-interview`, {
      method: "POST"
    });
  },

  getShortlistedChecklist(applicantId) {
    return this.request(`/api/admin/shortlisted/${encodeURIComponent(applicantId)}/checklist`);
  },

  saveShortlistedChecklist(applicantId, payload) {
    return this.request(`/api/admin/shortlisted/${encodeURIComponent(applicantId)}/checklist`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  deleteApplication(id) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  createDraftFromSubmission(id) {
    return this.request(`/api/admin/careers/employer-submissions/${encodeURIComponent(id)}/create-draft`, {
      method: "POST"
    });
  },

  deleteEmployerSubmission(id) {
    return this.request(`/api/admin/careers/employer-submissions/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  bulkDeleteEmployerSubmissions(ids) {
    return this.request("/api/admin/careers/employer-submissions/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids })
    });
  },

  createTalentPoolProfile(payload) {
    return this.request("/api/admin/careers/talent-pool", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateTalentPoolProfile(id, payload) {
    return this.request(`/api/admin/careers/talent-pool/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteTalentPoolProfile(id) {
    return this.request(`/api/admin/careers/talent-pool/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  bulkDeleteTalentPoolProfiles(ids) {
    return this.request("/api/admin/careers/talent-pool/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids })
    });
  },

  getSettings() {
    return this.request("/api/admin/dashboard/settings");
  },

  updateSettings(payload) {
    return this.request("/api/admin/dashboard/settings", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  getAccountSettings() {
    return this.request("/api/settings/account");
  },

  updateAccountSettings(payload) {
    return this.request("/api/settings/account", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  proxyMcp(payload) {
    return this.request("/api/mcp/proxy", {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  testMcpConnection(payload) {
    return fetch("/api/admin/mcp/test", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    }).then(async (response) => {
      const raw = await response.text();
      let data = null;

      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }

      if (!data) {
        throw new Error("Invalid MCP test response.");
      }

      if (response.status === 401 && data.redirectTo) {
        window.location.href = this.buildLoginRedirect(data.redirectTo);
        throw new Error("Dashboard authentication required.");
      }

      return data;
    });
  },

  startMcpOauth(provider, payload = {}) {
    return this.request("/api/admin/mcp/oauth/start", {
      method: "POST",
      body: JSON.stringify({
        provider,
        ...(payload || {})
      })
    });
  },

  runRoxanneMcpPrompt(payload = {}) {
    return fetch("/api/admin/mcp/llm-test", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    }).then(async (response) => {
      const raw = await response.text();
      let data = null;

      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }

      if (!data) {
        throw new Error("Invalid RoxanneAI MCP response.");
      }

      if (response.status === 401 && data.redirectTo) {
        window.location.href = this.buildLoginRedirect(data.redirectTo);
        throw new Error("Dashboard authentication required.");
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed (${response.status})`);
      }

      return data;
    });
  },

  getMessages() {
    return this.request("/api/admin/messages");
  },

  getMessageUnreadCount() {
    return this.request("/api/admin/messages/unread-count");
  },

  getRecentMessages(limit = 8) {
    return this.request(`/api/admin/messages/recent?limit=${encodeURIComponent(limit)}`);
  },

  getNotifications() {
    return this.request("/api/admin/notifications");
  },

  getNotificationUnreadCount() {
    return this.request("/api/admin/notifications/unread-count");
  },

  getRecentNotifications(limit = 10) {
    return this.request(`/api/admin/notifications/recent?limit=${encodeURIComponent(limit)}`);
  },

  markNotificationRead(id) {
    return this.request(`/api/admin/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST"
    });
  },

  deleteNotification(id) {
    return this.request(`/api/admin/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  markMessageRead(id) {
    return this.request(`/api/admin/messages/${encodeURIComponent(id)}/read`, {
      method: "POST"
    });
  },

  markMessageUnread(id) {
    return this.request(`/api/admin/messages/${encodeURIComponent(id)}/unread`, {
      method: "POST"
    });
  },

  archiveMessage(id) {
    return this.request(`/api/admin/messages/${encodeURIComponent(id)}/archive`, {
      method: "POST"
    });
  },

  addMessageToTalentPool(id, payload) {
    return this.request(`/api/admin/messages/${encodeURIComponent(id)}/add-to-talent-pool`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  attachMessageToJob(id, payload) {
    return this.request(`/api/admin/messages/${encodeURIComponent(id)}/attach-to-job`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  },

  getEmployerSubmissionsRefresh(since) {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.request(`/api/admin/careers/employer-submissions/refresh${query}`);
  },

  getApplicationsRefresh(since) {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.request(`/api/admin/careers/applications/refresh${query}`);
  },

  getTalentPoolRefresh(since) {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.request(`/api/admin/careers/talent-pool/refresh${query}`);
  },

  runAiFilter(positionId) {
    return this.request(`/api/admin/careers/positions/${encodeURIComponent(positionId)}/ai-filter`, {
      method: "POST"
    });
  },

  downloadPositionZip(positionId) {
    window.open(`/api/admin/careers/positions/${encodeURIComponent(positionId)}/download-zip`, "_blank");
  },

  downloadApplicationZip(id) {
    window.open(`/api/admin/careers/applications/${encodeURIComponent(id)}/download-zip`, "_blank");
  },

  getApplicationStageHistory(id) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/stage-history`);
  },

  getRejectionReasons() {
    return this.request("/api/admin/careers/rejection-reasons");
  },

  getApplicationOffers(id) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/offers`);
  },

  getApplicationFiles(id) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/files`);
  },

  updateFileVerification(fileId, payload) {
    return this.request(`/api/admin/careers/files/${encodeURIComponent(fileId)}/verification`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  setApplicationRejectionReason(id, payload) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/rejection`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  getApplicationEmailHistory(id) {
    return this.request(`/api/admin/careers/applications/${encodeURIComponent(id)}/email-history`);
  },

  getDuplicateSummary() {
    return this.request("/api/admin/careers/duplicates/summary");
  },

  getReportingMetrics() {
    return this.request("/api/admin/reports/metrics");
  },

  updateTalentPoolTags(id, tags) {
    return this.request(`/api/admin/careers/talent-pool/${encodeURIComponent(id)}/tags`, {
      method: "PATCH",
      body: JSON.stringify({ tags })
    });
  },

  markTalentPoolContacted(id) {
    return this.request(`/api/admin/careers/talent-pool/${encodeURIComponent(id)}/mark-contacted`, {
      method: "POST"
    });
  },

  runAnalysis(type) {
    return this.request(`/api/admin/reports/analysis/${encodeURIComponent(type)}`);
  },

  // ── Pipedrive CRM ─────────────────────────────────────────────────────────

  getPipedriveSettings() {
    // Returns { apiKeyConfigured, lastSyncAt, lastSyncResult } — never the key value
    return this.request("/api/admin/pipedrive/settings");
  },

  testPipedriveConnection() {
    // Key is read from PIPEDRIVE_API_KEY on the server — no key sent from browser
    return this.request("/api/admin/pipedrive/test", {
      method: "POST",
      body: JSON.stringify({})
    });
  },

  syncApplicantsToPipedrive() {
    // confirmed: true is REQUIRED — the frontend warning modal must set this
    return this.request("/api/admin/pipedrive/sync", {
      method: "POST",
      body: JSON.stringify({ confirmed: true })
    });
  },

  // ── Manual applicant creation ──────────────────────────────────────────

  createManualApplicant(data) {
    return this.request("/api/admin/careers/applications/manual", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  bulkImportApplicants(rows) {
    return this.request("/api/admin/careers/applications/bulk-manual", {
      method: "POST",
      body: JSON.stringify({ rows })
    });
  },

  // ── Applicant contact edits (phone sync) ──────────────────────────────
  updateApplicantPhone(id, phone) {
    return this.request(`/api/admin/careers/applications/${id}/phone`, {
      method: "PATCH",
      body: JSON.stringify({ phone })
    });
  },

  // ── Delete with optional Pipedrive cleanup ────────────────────────────
  deleteApplicationWithPipedrive(id) {
    return this.request(`/api/admin/careers/applications/${id}?includePipedrive=1`, {
      method: "DELETE"
    });
  },
};
