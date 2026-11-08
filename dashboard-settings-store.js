import "./env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeEmail } from "./applicant-identity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveSettingsDir = () => {
  const diskPath = process.env.RENDER_DISK_MOUNT_PATH || process.env.RENDER_DATA_DIR;
  if (diskPath) return path.resolve(diskPath);
  return path.join(__dirname, "data");
};
const dataDir = resolveSettingsDir();
const settingsPath = path.join(dataDir, "dashboard-settings.json");

console.log(`[settings] path=${settingsPath}`);
fs.mkdirSync(dataDir, { recursive: true });

const cleanText = (value) => String(value || "").trim();
const clampText = (value, max = 160) => cleanText(value).slice(0, max);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
const isSafeAvatarUrl = (value) => {
  const next = cleanText(value);
  if (!next) return true;
  return /^(https?:\/\/|\/|data:image\/)/i.test(next);
};

const allowedViews = new Set(["dashboard", "positions", "applicants", "settings", "requisitions"]);
const allowedDensity = new Set(["balanced", "dense"]);
const allowedAccent = new Set(["orange", "gold"]);
const allowedPermissions = new Set(["read-only", "read-write", "admin-access"]);
const defaultDashboardEmail = normalizeEmail(process.env.DASHBOARD_ADMIN_EMAIL) || "admin@heya.com.pg";
const defaultDashboardImageUrl = cleanText(process.env.DASHBOARD_PROFILE_IMAGE_URL || "/imgs/heya-talent-solutions-mark.jpg?v=20260518");
const defaultMcpEndpoint = cleanText(process.env.MCP_ENDPOINT || process.env.ROXANNE_MCP_ENDPOINT || "https://roxannemcp.onrender.com").replace(/\/+$/, "");

const pluginKeys = [
  "aiAssistant",
  "tweaksPanel",
  "analyticsPro",
  "customerCrm",
  "marketingFunnel",
  "jobBoardBooster"
];

const defaultSettings = {
  accountSettings: {
    id: "acct-dashboard-admin",
    userId: "dashboard-admin",
    fullName: "Heya Talent Solutions Admin",
    email: defaultDashboardEmail,
    phone: "",
    role: "Dashboard Admin",
    avatarUrl: defaultDashboardImageUrl,
    notificationPreferences: {
      inApp: true,
      emailAlerts: false,
      newApplications: true,
      newMessages: true,
      productUpdates: false
    },
    displayPreferences: {
      defaultView: "dashboard",
      density: "balanced",
      accent: "orange"
    },
    createdAt: null,
    updatedAt: null
  },
  profile: {
    username: "dashboard-admin",
    displayName: "Heya Talent Solutions Admin",
    email: defaultDashboardEmail,
    avatarUrl: defaultDashboardImageUrl
  },
  preferences: {
    defaultView: "dashboard",
    density: "balanced",
    accent: "orange"
  },
  plugins: {
    aiAssistant: true,
    tweaksPanel: true,
    analyticsPro: false,
    customerCrm: false,
    marketingFunnel: false,
    jobBoardBooster: false
  },
    mcp: {
      enabled: false,
      connected: false,
      serverLabel: "roxanneMCP server",
      proxyPath: "/api/mcp/proxy",
    facebookAuthPath: "/facebook/auth",
      linkedinAuthPath: "/linkedin/auth",
    endpoint: defaultMcpEndpoint,
    apiKey: "",
    permissions: "read-only"
  },
  integrations: {
    mcpConfigurations: {
      provider: "RoxanneAI",
      enabled: true,
      hubLabel: "Powered by RoxanneAI",
      endpoint: defaultMcpEndpoint,
      notes: "Use this area to connect MCP-powered dashboard extensions and tool configurations."
    },
    apps: {
      facebook: {
        enabled: false,
        connected: false,
        label: "Facebook",
        description: "Connect Meta pages, campaigns, and engagement signals into the dashboard."
      },
      linkedin: {
        enabled: false,
        connected: false,
        label: "LinkedIn",
        description: "Connect LinkedIn recruiting, posting, and professional outreach workflows."
      },
      spacemail: {
        enabled: false,
        connected: false,
        label: "SpaceMail Email",
        description: "Connect mailbox automation and message routing for the hiring dashboard."
      }
    }
  },
  updatedAt: null
};

const deriveUsername = (accountSettings = {}, profile = {}) => {
  const explicitUsername = clampText(profile.username, 80).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (explicitUsername) return explicitUsername;
  const email = normalizeEmail(accountSettings.email);
  if (email.includes("@")) return email.split("@")[0];
  const fullName = clampText(accountSettings.fullName, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return fullName || "dashboard-admin";
};

const sanitizeDisplayPreferences = (input = {}, current = defaultSettings.accountSettings.displayPreferences) => ({
  defaultView: allowedViews.has(input.defaultView) ? input.defaultView : current.defaultView,
  density: allowedDensity.has(input.density) ? input.density : current.density,
  accent: allowedAccent.has(input.accent) ? input.accent : current.accent
});

const sanitizeNotificationPreferences = (input = {}, current = defaultSettings.accountSettings.notificationPreferences) => ({
  inApp: Boolean(input.inApp ?? current.inApp),
  emailAlerts: Boolean(input.emailAlerts ?? current.emailAlerts),
  newApplications: Boolean(input.newApplications ?? current.newApplications),
  newMessages: Boolean(input.newMessages ?? current.newMessages),
  productUpdates: Boolean(input.productUpdates ?? current.productUpdates)
});

const sanitizePlugins = (input = {}, current = defaultSettings.plugins) => Object.fromEntries(
  pluginKeys.map((key) => [key, Boolean(input[key] ?? current[key])])
);

const sanitizeMcp = (input = {}, current = defaultSettings.mcp) => ({
  enabled: Boolean(input.enabled ?? current.enabled),
  connected: Boolean(input.connected ?? current.connected),
  serverLabel: defaultSettings.mcp.serverLabel,
  proxyPath: clampText(input.proxyPath ?? current.proxyPath, 500) || current.proxyPath,
  facebookAuthPath: clampText(input.facebookAuthPath ?? current.facebookAuthPath, 500) || current.facebookAuthPath,
  linkedinAuthPath: clampText(input.linkedinAuthPath ?? current.linkedinAuthPath, 500) || current.linkedinAuthPath,
  endpoint: defaultMcpEndpoint,
  apiKey: "",
  permissions: allowedPermissions.has(input.permissions) ? input.permissions : current.permissions
});

const sanitizeIntegrations = (input = {}, current = defaultSettings.integrations, mcpSource = defaultSettings.mcp) => {
  const currentMcp = sanitizeMcp(mcpSource, defaultSettings.mcp);
  const provider = "roxanneMCP server";
  const hubLabel = clampText(input.mcpConfigurations?.hubLabel ?? current.mcpConfigurations.hubLabel, 160) || current.mcpConfigurations.hubLabel;
  const notes = clampText(input.mcpConfigurations?.notes ?? current.mcpConfigurations.notes, 500) || current.mcpConfigurations.notes;

  return {
    mcpConfigurations: {
      provider,
      enabled: Boolean(currentMcp.enabled),
      hubLabel,
      endpoint: defaultMcpEndpoint,
      notes
    },
    apps: {
      facebook: {
        ...current.apps.facebook,
        enabled: false,
        connected: false,
        label: "Facebook",
        description: current.apps.facebook.description
      },
      linkedin: {
        ...current.apps.linkedin,
        enabled: false,
        connected: false,
        label: "LinkedIn",
        description: current.apps.linkedin.description
      },
      spacemail: {
        ...current.apps.spacemail,
        enabled: false,
        connected: false,
        label: "SpaceMail Email",
        description: current.apps.spacemail.description
      }
    }
  };
};

const normalizeAccountSettingsRecord = (record = {}, fallback = defaultSettings.accountSettings) => {
  const base = {
    ...fallback,
    ...record,
    notificationPreferences: sanitizeNotificationPreferences(record.notificationPreferences || {}, fallback.notificationPreferences),
    displayPreferences: sanitizeDisplayPreferences(record.displayPreferences || {}, fallback.displayPreferences)
  };
  const fullName = clampText(base.fullName, 120) || fallback.fullName;
  const email = normalizeEmail(base.email || fallback.email);

  return {
    id: cleanText(base.id) || fallback.id,
    userId: cleanText(base.userId) || fallback.userId,
    fullName,
    email: email || fallback.email,
    phone: clampText(base.phone, 40),
    role: clampText(base.role, 120),
    avatarUrl: clampText(base.avatarUrl, 500),
    notificationPreferences: sanitizeNotificationPreferences(base.notificationPreferences, fallback.notificationPreferences),
    displayPreferences: sanitizeDisplayPreferences(base.displayPreferences, fallback.displayPreferences),
    createdAt: base.createdAt || fallback.createdAt || null,
    updatedAt: base.updatedAt || fallback.updatedAt || null
  };
};

const syncLegacySettings = (settings) => {
  const accountSettings = normalizeAccountSettingsRecord(settings.accountSettings, defaultSettings.accountSettings);
  const username = deriveUsername(accountSettings, settings.profile || {});
  const plugins = sanitizePlugins(settings.plugins || {}, defaultSettings.plugins);
  const baseMcp = sanitizeMcp(settings.mcp || {}, defaultSettings.mcp);
  const integrations = sanitizeIntegrations(settings.integrations || {}, defaultSettings.integrations, baseMcp);
  const mcp = sanitizeMcp({
    ...baseMcp,
    enabled: settings.mcp?.enabled ?? integrations.mcpConfigurations.enabled,
    connected: settings.mcp?.connected ?? false,
    serverLabel: defaultSettings.mcp.serverLabel,
    proxyPath: settings.mcp?.proxyPath ?? defaultSettings.mcp.proxyPath,
    endpoint: defaultMcpEndpoint,
    apiKey: "",
    permissions: settings.mcp?.permissions ?? defaultSettings.mcp.permissions
  }, defaultSettings.mcp);

  const syncedIntegrations = sanitizeIntegrations(integrations, defaultSettings.integrations, mcp);

  return {
    ...settings,
    accountSettings,
    profile: {
      username,
      displayName: clampText(settings.profile?.displayName, 120) || accountSettings.fullName,
      email: normalizeEmail(settings.profile?.email || accountSettings.email) || accountSettings.email,
      avatarUrl: clampText(settings.profile?.avatarUrl ?? accountSettings.avatarUrl, 500)
    },
    preferences: {
      defaultView: sanitizeDisplayPreferences(settings.preferences || {}, accountSettings.displayPreferences).defaultView,
      density: sanitizeDisplayPreferences(settings.preferences || {}, accountSettings.displayPreferences).density,
      accent: sanitizeDisplayPreferences(settings.preferences || {}, accountSettings.displayPreferences).accent
    },
    plugins,
    mcp,
    integrations: syncedIntegrations,
    updatedAt: accountSettings.updatedAt || settings.updatedAt || null
  };
};

const readSettingsFile = () => {
  const seededDefault = syncLegacySettings({ ...defaultSettings });
  if (!fs.existsSync(settingsPath)) {
    writeSettingsFile(seededDefault);
    return seededDefault;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const legacyFallback = {
      ...seededDefault.accountSettings,
      fullName: clampText(raw.accountSettings?.fullName || raw.profile?.displayName || seededDefault.profile.displayName, 120),
      email: normalizeEmail(raw.accountSettings?.email || raw.profile?.email || seededDefault.profile.email),
      avatarUrl: clampText(raw.accountSettings?.avatarUrl || raw.profile?.avatarUrl || seededDefault.profile.avatarUrl, 500),
      displayPreferences: sanitizeDisplayPreferences({
        defaultView: raw.accountSettings?.displayPreferences?.defaultView || raw.preferences?.defaultView,
        density: raw.accountSettings?.displayPreferences?.density || raw.preferences?.density,
        accent: raw.accountSettings?.displayPreferences?.accent || raw.preferences?.accent
      }, seededDefault.accountSettings.displayPreferences),
      notificationPreferences: sanitizeNotificationPreferences(raw.accountSettings?.notificationPreferences || {}, seededDefault.accountSettings.notificationPreferences),
      phone: clampText(raw.accountSettings?.phone, 40),
      role: clampText(raw.accountSettings?.role, 120),
      createdAt: raw.accountSettings?.createdAt || raw.updatedAt || null,
      updatedAt: raw.accountSettings?.updatedAt || raw.updatedAt || null
    };

    const legacyServiceEnabled = Boolean(
      raw.integrations?.apps?.facebook?.enabled ||
      raw.integrations?.apps?.linkedin?.enabled ||
      raw.integrations?.apps?.spacemail?.enabled
    );
    const legacyServiceConnected = Boolean(
      raw.integrations?.apps?.facebook?.connected ||
      raw.integrations?.apps?.linkedin?.connected ||
      raw.integrations?.apps?.spacemail?.connected
    );
    const rawMcp = raw.mcp || {
      enabled: raw.integrations?.mcpConfigurations?.enabled ?? legacyServiceEnabled,
      connected: legacyServiceConnected,
      serverLabel: raw.integrations?.mcpConfigurations?.provider,
      proxyPath: raw.mcp?.proxyPath,
      facebookAuthPath: raw.mcp?.facebookAuthPath,
      linkedinAuthPath: raw.mcp?.linkedinAuthPath,
      endpoint: raw.integrations?.mcpConfigurations?.endpoint,
      permissions: raw.integrations?.mcpConfigurations?.permissions
    };

    return syncLegacySettings({
      accountSettings: normalizeAccountSettingsRecord(raw.accountSettings || legacyFallback, legacyFallback),
      profile: raw.profile || seededDefault.profile,
      preferences: raw.preferences || seededDefault.preferences,
      plugins: sanitizePlugins(raw.plugins || {}, seededDefault.plugins),
      mcp: sanitizeMcp(rawMcp, seededDefault.mcp),
      integrations: sanitizeIntegrations(raw.integrations || {}, seededDefault.integrations, sanitizeMcp(rawMcp, seededDefault.mcp)),
      updatedAt: raw.updatedAt || legacyFallback.updatedAt || null
    });
  } catch {
    return seededDefault;
  }
};

const writeSettingsFile = (settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(syncLegacySettings(settings), null, 2), "utf8");
};

const sanitizeAccountSettingsInput = (payload = {}, current = readSettingsFile().accountSettings) => {
  const nextEmail = normalizeEmail(payload.email ?? current.email);
  if (!nextEmail || !isEmail(nextEmail)) {
    throw new Error("A valid email address is required.");
  }

  const nextFullName = clampText(payload.fullName ?? current.fullName, 120);
  if (!nextFullName) {
    throw new Error("Full name is required.");
  }

  const nextAvatarUrl = clampText(payload.avatarUrl ?? current.avatarUrl, 500);
  if (!isSafeAvatarUrl(nextAvatarUrl)) {
    throw new Error("Avatar URL must be a valid image URL or site path.");
  }

  const timestamp = new Date().toISOString();
  return normalizeAccountSettingsRecord({
    ...current,
    fullName: nextFullName,
    email: nextEmail,
    phone: clampText(payload.phone ?? current.phone, 40),
    role: clampText(payload.role ?? current.role, 120),
    avatarUrl: nextAvatarUrl,
    notificationPreferences: sanitizeNotificationPreferences(payload.notificationPreferences || {}, current.notificationPreferences),
    displayPreferences: sanitizeDisplayPreferences(payload.displayPreferences || {}, current.displayPreferences),
    createdAt: current.createdAt || timestamp,
    updatedAt: timestamp
  }, current);
};

const sanitizeSettingsInput = (payload = {}) => {
  const safe = readSettingsFile();
  const hasAccountPatch = Boolean(payload.accountSettings || payload.profile || payload.preferences);
  const accountSettings = hasAccountPatch
    ? sanitizeAccountSettingsInput({
        ...(payload.accountSettings || {}),
        fullName: payload.accountSettings?.fullName ?? payload.profile?.displayName,
        email: payload.accountSettings?.email ?? payload.profile?.email,
        avatarUrl: payload.accountSettings?.avatarUrl ?? payload.profile?.avatarUrl,
        displayPreferences: {
          defaultView: payload.accountSettings?.displayPreferences?.defaultView ?? payload.preferences?.defaultView,
          density: payload.accountSettings?.displayPreferences?.density ?? payload.preferences?.density,
          accent: payload.accountSettings?.displayPreferences?.accent ?? payload.preferences?.accent
        }
      }, safe.accountSettings)
    : safe.accountSettings;

  const mcp = sanitizeMcp(payload.mcp || {}, safe.mcp || defaultSettings.mcp);

  return syncLegacySettings({
    accountSettings,
    profile: {
      ...safe.profile,
      ...(payload.profile || {})
    },
    preferences: sanitizeDisplayPreferences(payload.preferences || {}, safe.preferences || defaultSettings.preferences),
    plugins: sanitizePlugins(payload.plugins || {}, safe.plugins || defaultSettings.plugins),
    mcp,
    integrations: sanitizeIntegrations(payload.integrations || {}, safe.integrations || defaultSettings.integrations, mcp),
    updatedAt: accountSettings.updatedAt
  });
};

const getDashboardSettings = () => readSettingsFile();

const updateDashboardSettings = (payload = {}) => {
  const next = sanitizeSettingsInput(payload);
  writeSettingsFile(next);
  return next;
};

const getAccountSettings = () => readSettingsFile().accountSettings;

const updateAccountSettings = (payload = {}) => {
  const current = readSettingsFile();
  const accountSettings = sanitizeAccountSettingsInput(payload, current.accountSettings);
  const next = syncLegacySettings({
    ...current,
    accountSettings,
    updatedAt: accountSettings.updatedAt
  });
  writeSettingsFile(next);
  return {
    accountSettings: next.accountSettings,
    settings: next
  };
};

export const dashboardSettingsStore = {
  getDashboardSettings,
  updateDashboardSettings,
  getAccountSettings,
  updateAccountSettings,
  settingsPath
};

export default dashboardSettingsStore;
