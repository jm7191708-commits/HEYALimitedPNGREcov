import "./env.js";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { ZipArchive } from "archiver";
import OpenAI from "openai";

import { dbOps } from "./db.js";
import { accountSettingsController } from "./controllers/accountSettingsController.js";
import { getBusinessEmail, getEmailConfigStatus, sendCareersMailboxNotification, sendEnquiryEmails } from "./controllers/emailController.js";
import { careersDb } from "./careers-db.js";
import { dashboardSettingsStore } from "./dashboard-settings-store.js";
import { normalizeEmail } from "./applicant-identity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === "production";

const isLocalUrl = (value) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(String(value || ""));
const getChatbotApiUrl = () => {
  const apiUrl = process.env.CHATBOT_API_URL || "/api/chat";
  if (isProduction && isLocalUrl(apiUrl)) {
    console.warn("CHATBOT_API_URL points to localhost in production. Falling back to /api/chat.");
    return "/api/chat";
  }

  return apiUrl;
};

const chatbotModel = process.env.CHATBOT_MODEL || "gpt-4.1-mini";
const chatbotMaxOutputTokens = Number(process.env.CHATBOT_MAX_OUTPUT_TOKENS || 300);
const openaiApiKey = process.env.OPENAI_API_KEY || "";
if (!openaiApiKey) {
  console.warn("OPENAI_API_KEY is not set. Chatbot will use knowledge-base fallback responses.");
}
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const parseTrustProxy = (value) => {
  if (typeof value === "undefined") {
    return isProduction || process.env.RENDER === "true" ? 1 : false;
  }

  if (value === "true") return 1;
  if (value === "false") return false;

  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : value;
};

app.disable("x-powered-by");
app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const csv = (value) => String(value || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const baseOrigins = new Set([
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.RENDER_EXTERNAL_URL
].filter(Boolean));

const configuredOrigins = () => new Set([...baseOrigins, ...csv(process.env.ALLOWED_ORIGINS)]);

const getRequestOrigin = (req) => {
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : "";
};

const isAllowedOrigin = (req) => {
  const origin = req.get("origin");
  if (!origin) return true;
  if (origin === getRequestOrigin(req)) return true;
  if (configuredOrigins().has(origin)) return true;

  return !isProduction && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
};

app.use(cors((req, callback) => {
  callback(null, {
    origin: isAllowedOrigin(req),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-token",
      "x-mcp-api-key",
      "x-heya-mcp-source",
      "x-heya-mcp-permissions"
    ],
    optionsSuccessStatus: 204
  });
}));

app.use(bodyParser.json({ limit: "12mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "12mb" }));

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

const render = (res, view, data = {}) => {
  res.render(view, {
    ...data,
    businessEmail: getBusinessEmail(),
    chatbotConfig: {
      apiUrl: getChatbotApiUrl(),
      model: chatbotModel,
      openaiConfigured: Boolean(openaiClient),
      isProduction
    }
  });
};

const dashboardFrontendPath = path.join(__dirname, "admin-dashboard", "frontend");
const careersPageData = () => careersDb.getPublicJobBoardData();
const safeDashboardFile = (baseDir, relativePath) => {
  const absolutePath = path.resolve(baseDir, relativePath);
  return absolutePath.startsWith(path.resolve(baseDir)) ? absolutePath : null;
};

// --- Load Knowledge Base ---
let knowledgeBase = { content: "" };
let knowledgeBaseLoaded = false;
try {
  const kbPath = path.join(__dirname, "scripts", "knowledge_base.json");
  const kbContent = fs.readFileSync(kbPath, "utf-8");
  knowledgeBase = JSON.parse(kbContent);
  knowledgeBaseLoaded = true;
  console.log("Knowledge base loaded successfully.");
} catch (error) {
  console.error("Error loading knowledge base:", error);
}
const kbText = knowledgeBase.content || "";

// Helper function to find a relevant response from knowledge base
// This is a very basic implementation.
function findResponseInKB(query, kbContent) {
  const cleanQueryWords = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!kbContent || cleanQueryWords.length === 0) return null;

  const lines = kbContent.split(/\r?\n/);

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    for (const word of cleanQueryWords) {
      if (lowerLine.includes(word)) {
        const snippet = line.trim();
        if (snippet.length > 50) {
          return snippet;
        } else if (snippet.length > 5) {
          return snippet;
        }
      }
    }
  }
  return null;
}

const getChatbotFallbackResponse = (userMessage) => {
  const query = String(userMessage || "").toLowerCase();
  const hasAny = (...terms) => terms.some((term) => query.includes(term));

  if (hasAny("service", "offer", "recruit", "screen", "source", "mobil", "labour", "labor")) {
    return "HEYA Talent Solutions supports employers with recruitment and talent acquisition, labour hire and workforce solutions, onboarding and mobilization, HR and workforce support, training and job-ready programs, and advertising and talent marketing.";
  }

  if (hasAny("advertise", "vacancy", "job post", "post a job", "hiring", "hire")) {
    return "To advertise a vacancy, open the Advertise a Vacancy page and submit your role, company, industry, location, contact details, and any workforce requirements. The HEYA team can then recommend the right advertising or recruitment support.";
  }

  if (hasAny("package", "price", "cost", "quote", "silver", "bronze", "gold")) {
    return "Packages are quote-based so employers can choose support around hiring volume, urgency, and visibility. Silver supports listing visibility, Bronze supports priority reach, and Gold supports a strategic recruitment partnership.";
  }

  if (hasAny("contact", "email", "phone", "call", "location", "address")) {
    return `You can contact HEYA Talent Solutions by email at ${getBusinessEmail()}, phone at 71555038, or through the Contact page. The team is based in Port Moresby, Papua New Guinea.`;
  }

  if (hasAny("industry", "mining", "oil", "gas", "construction", "engineering", "security", "public sector", "government", "private business", "resources", "fifo")) {
    return "HEYA Talent Solutions supports mining and resources, oil and gas, construction and infrastructure, logistics and transport, hospitality and catering, security services, government and public sector, retail and commercial, agriculture, health and community services, telecommunications, and professional services.";
  }

  if (hasAny("about", "founder", "hekeria", "heya", "talent solutions")) {
    return "HEYA Talent Solutions is the workforce and recruitment division of HEYA Limited, a Papua New Guinean-owned company operating as a Strategic Talent Acquisition Partner for Papua New Guinea.";
  }

  const fallbackResponse = findResponseInKB(userMessage, kbText);
  if (fallbackResponse && fallbackResponse.length > 24) {
    return fallbackResponse;
  }

  return "I can help with HEYA Talent Solutions services, vacancy advertising, recruitment support, labour hire, onboarding, workforce support, packages, and contact details. Please ask about the hiring support you need, or use the contact form to reach the HEYA team directly.";
};

app.get("/api/chat/status", (_req, res) => {
  res.json({
    ok: true,
    apiUrl: getChatbotApiUrl(),
    model: chatbotModel,
    openaiConfigured: Boolean(openaiClient),
    knowledgeBaseLoaded
  });
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ ok: false, error: "Message is required" });
  }

  const userMessage = String(message).trim().slice(0, 1200);
  if (!userMessage) {
    return res.status(400).json({ ok: false, error: "Message is required" });
  }

  if (!openaiClient) {
    return res.json({
      ok: true,
      mode: "knowledge-base",
      response: getChatbotFallbackResponse(userMessage)
    });
  }

  let response = getChatbotFallbackResponse(userMessage);

  try {
    const relevantContext = findResponseInKB(userMessage, kbText);
    const completion = await openaiClient.responses.create({
      model: chatbotModel,
      max_output_tokens: Number.isFinite(chatbotMaxOutputTokens) && chatbotMaxOutputTokens > 0
        ? chatbotMaxOutputTokens
        : 300,
      input: [
        {
          role: "system",
          content: "You are the website assistant for HEYA Talent Solutions, the workforce and recruitment division of HEYA Limited and Strategic Talent Acquisition Partner for Papua New Guinea. Answer questions about recruitment, labour hire, onboarding, HR and workforce support, training, talent marketing, vacancy advertising, packages, industries served, and contact details. Keep answers concise, practical, and employer-focused. If the question needs private or custom advice, guide the user to submit the contact or vacancy form."
        },
        {
          role: "user",
          content: relevantContext
            ? `Use this site context when helpful:\n${relevantContext}\n\nUser question: ${userMessage}`
            : userMessage
        }
      ]
    });

    if (completion.output_text) {
      response = completion.output_text.trim();
    }
  } catch (error) {
    console.error("Error processing chat message with OpenAI:", error?.message || error);
  }

  res.json({ ok: true, response });
});


app.get("/", (_req, res) => {
  render(res, "index", { active: "home", pageTitle: "HEYA Talent Solutions" });
});

app.get("/index", (_req, res) => {
  res.redirect(301, "/");
});

app.get("/about", (_req, res) => {
  render(res, "about", { active: "about", pageTitle: "About | HEYA Talent Solutions" });
});

app.get("/services", (_req, res) => {
  render(res, "services", { active: "services", pageTitle: "Services | HEYA Talent Solutions" });
});

app.get("/packages", (_req, res) => {
  render(res, "packages", { active: "packages", pageTitle: "Packages | HEYA Talent Solutions" });
});

app.get("/contact", (req, res) => {
  render(res, "contact", { active: "contact", pageTitle: "Contact | HEYA Talent Solutions" });
});

app.get("/careers", (_req, res) => {
  render(res, "careers", { active: "careers", pageTitle: "Careers | HEYA Talent Solutions" });
});

app.get("/careers/employers", (_req, res) => {
  const careerData = careersPageData();
  render(res, "careers-employers", {
    active: "careers",
    pageTitle: "Employers Portal | HEYA Talent Solutions",
    jobs: careerData.jobs,
    careerStats: careerData.stats
  });
});

app.get("/careers/jobseekers", (_req, res) => {
  const careerData = careersPageData();
  render(res, "careers-jobseekers", {
    active: "careers",
    pageTitle: "Job Seekers Portal | HEYA Talent Solutions",
    jobs: careerData.jobs,
    careerStats: careerData.stats
  });
});

app.get("/careers/vacancies", (_req, res) => {
  const careerData = careersPageData();
  render(res, "careers-vacancies", {
    active: "vacancies",
    pageTitle: "Current Vacancies | HEYA Talent Solutions",
    jobs: careerData.jobs,
    careerStats: careerData.stats,
    industries: careerData.filters.industries,
    locations: careerData.filters.locations,
    types: careerData.filters.types,
    levels: careerData.filters.levels
  });
});

app.get("/advertise", (_req, res) => {
  render(res, "advertise", { active: "advertise", pageTitle: "Advertise a Vacancy | HEYA Talent Solutions" });
});

app.get("/apply", (_req, res) => {
  res.redirect(302, "/careers/vacancies");
});

app.get("/portfolio", (_req, res) => {
  res.redirect(301, "/packages");
});

app.get(["/Research", "/research"], (_req, res) => {
  res.redirect(301, "/services");
});

app.get(["/Consultants", "/consultants"], (_req, res) => {
  res.redirect(301, "/about");
});

app.get("/AI-Coming_soonPage", (_req, res) => {
  res.redirect(301, "/");
});

app.get(/^\/(.+)\.html$/, (req, res) => {
  const cleanUrl = req.path.replace(/\.html$/, "");
  res.redirect(301, cleanUrl);
});

app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const cleanMultiline = (value) => String(value || "").replace(/[\r\n]+/g, '\n').trim();
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const missing = (fields, body) => fields.filter((field) => !cleanText(body[field]));
const requestMeta = (req) => ({
  sourcePath: req.get("referer") || req.originalUrl,
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get("user-agent") || null
});

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");
const ensureLeadingSlash = (value) => {
  const next = String(value || "").trim();
  if (!next) return "/";
  return next.startsWith("/") ? next : `/${next}`;
};
const extractMcpPath = (value, fallback = "/") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  try {
    return new URL(raw).pathname || fallback;
  } catch {
    return ensureLeadingSlash(raw);
  }
};
const roxanneMcpServerLabel = "roxanneMCP server";
const configuredMcpEndpoint = trimTrailingSlash(process.env.MCP_ENDPOINT || process.env.MCP_GATEWAY_URL || process.env.ROXANNE_MCP_ENDPOINT || "https://roxannemcp.onrender.com");
const configuredMcpApiKey = String(process.env.MCP_API_KEY || process.env.MCP_SECRET || process.env.ROXANNE_MCP_API_KEY || "").trim();
const configuredMcpClientId = String(process.env.MCP_CLIENT_ID || "").trim();
const configuredMcpScopes = String(process.env.MCP_SCOPES || "mcp:execute,mcp:agent,memory:read,memory:write,social:facebook,social:linkedin").trim();
const configuredMcpAllowedTools = new Set(
  String(process.env.MCP_ALLOWED_TOOLS || "linkedin_post,facebook_post").split(",").map(s => s.trim()).filter(Boolean)
);
const configuredFacebookAppId = String(process.env.FACEBOOK_APP_ID || "").trim();
const configuredFacebookClientSecret = String(process.env.FACEBOOK_CLIENT_SECRET || "").trim();
const readMcpSettings = () => {
  const settings = dashboardSettingsStore.getDashboardSettings();
  const mcp = settings?.mcp || {};
  return {
    enabled: Boolean(mcp.enabled),
    connected: Boolean(mcp.connected),
    endpoint: configuredMcpEndpoint,
    apiKey: configuredMcpApiKey,
    permissions: String(mcp.permissions || configuredMcpScopes).trim(),
    proxyPath: ensureLeadingSlash(mcp.proxyPath || "/api/mcp/proxy"),
    serverLabel: roxanneMcpServerLabel,
    facebookAuthPath: extractMcpPath(mcp.facebookAuthPath, "/facebook/auth"),
    linkedinAuthPath: extractMcpPath(mcp.linkedinAuthPath, "/linkedin/auth")
  };
};
const publicDashboardSettings = (settings) => ({
  ...settings,
  mcp: {
    ...(settings?.mcp || {}),
    endpoint: configuredMcpEndpoint,
    apiKey: "",
    apiKeyConfigured: Boolean(configuredMcpApiKey)
  },
  integrations: {
    ...(settings?.integrations || {}),
    mcpConfigurations: {
      ...(settings?.integrations?.mcpConfigurations || {}),
      endpoint: configuredMcpEndpoint
    }
  }
});
const isJsonContentType = (value) => String(value || "").toLowerCase().includes("application/json");
const safeResponseSnippet = (value, max = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const allowedMcpProviders = new Set(["facebook", "linkedin"]);
const mcpExplicitConnectPattern = /please connect\s+\w+\s+via|connect\s+(?:facebook|linkedin)\s+via/i;
const mcpTerminalErrorCodes = new Set(["invalid_credential", "invalid_api_key", "unauthorized", "forbidden"]);
const mcpProviderUnavailablePattern = /\b(not installed|not configured|not enabled|unknown tool|tool not found|provider unavailable|integration unavailable|missing integration)\b/i;
const parseMcpReauth = (result, settings = readMcpSettings()) => {
  const data = result?.data && typeof result.data === "object" ? result.data : {};
  const code = String(data.code || data.errorCode || data.error || "").toLowerCase();
  const providerHint = (() => { const m = String(data.message || ""); return /facebook/i.test(m) ? "facebook" : /linkedin/i.test(m) ? "linkedin" : ""; })();
  const provider = String(data.provider || data.service || providerHint || "").toLowerCase();
  const authUrl = cleanText(data.authUrl || data.oauthUrl || data.reAuthUrl || "");

  if (mcpTerminalErrorCodes.has(code)) {
    return { reauthRequired: false, terminal: true, code, provider: "", authUrl: "" };
  }

  const reauthRequired = Boolean(
    data.reauthRequired ||
    data.needsReauth ||
    code === "reauth_required" ||
    code === "oauth_required" ||
    ((result?.status === 401 || result?.status === 403) && authUrl)
  );

  if (!reauthRequired) {
    const mcpMessage = String(data.message || data.error || "");
    if (!result?.ok && mcpExplicitConnectPattern.test(mcpMessage)) {
      const detectedProvider = /facebook/i.test(mcpMessage) ? "facebook" : /linkedin/i.test(mcpMessage) ? "linkedin" : "";
      return { reauthRequired: true, provider: detectedProvider, authUrl: "" };
    }
    return {
      reauthRequired: false,
      provider: provider && allowedMcpProviders.has(provider) ? provider : "",
      authUrl
    };
  }

  const safeProvider = provider && allowedMcpProviders.has(provider) ? provider : "";
  return {
    reauthRequired: true,
    provider: safeProvider,
    authUrl
  };
};

async function forwardMcpRequest({
  targetPath = "/",
  method = "POST",
  payload = null,
  headers = {},
  query = null,
  redirect = "follow",
  requireEnabled = true
} = {}) {
  const config = readMcpSettings();
  if (requireEnabled && !config.enabled) {
    throw new Error("MCP proxy is disabled in dashboard settings.");
  }
  if (!config.endpoint) {
    throw new Error("MCP endpoint is not configured.");
  }
  if (!config.apiKey) {
    throw new Error("MCP API key or token is not configured.");
  }

  const nextMethod = String(method || "POST").toUpperCase();
  const normalizedPath = ensureLeadingSlash(String(targetPath || "/").replace(/^https?:\/\/[^/]+/i, ""));
  const url = new URL(`${config.endpoint}${normalizedPath}`);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  const requestHeaders = {
    "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
    "Authorization": `Bearer ${config.apiKey}`,
    "x-mcp-api-key": config.apiKey,
    "x-heya-mcp-permissions": config.permissions,
    "x-heya-mcp-source": "heya-dashboard",
    ...(configuredMcpClientId ? { "x-mcp-client-id": configuredMcpClientId } : {}),
    ...headers
  };

  const fetchOptions = {
    method: nextMethod,
    headers: requestHeaders,
    redirect
  };

  if (!["GET", "HEAD"].includes(nextMethod) && payload !== null && typeof payload !== "undefined") {
    fetchOptions.body = JSON.stringify(payload);
    if (!fetchOptions.headers["Content-Type"]) {
      fetchOptions.headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url, fetchOptions);
  const contentType = String(response.headers.get("content-type") || "");
  const location = String(response.headers.get("location") || "");
  const raw = await response.text();
  let data = null;

  if (raw && isJsonContentType(contentType)) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: url.toString(),
    location,
    contentType,
    data,
    raw
  };
}

const getMcpAuthStartPath = (provider, settings = readMcpSettings()) => {
  if (!allowedMcpProviders.has(provider)) {
    throw new Error("Unsupported MCP provider.");
  }
  return provider === "facebook" ? settings.facebookAuthPath : settings.linkedinAuthPath;
};

const extractAuthUrlFromResult = (result) => {
  const data = result?.data && typeof result.data === "object" ? result.data : {};
  return cleanText(
    data.authUrl ||
    data.oauthUrl ||
    data.authorizeUrl ||
    data.redirectUrl ||
    data.reAuthUrl ||
    result?.location ||
    ""
  );
};

const parseJsonLikePayload = (value) => {
  const text = String(value || "")
    .trim()
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  if (!text) return null;

  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(text.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(text.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
};

const dashboardMcpUserId = (email) => {
  const cleanEmail = cleanText(email).toLowerCase();
  return cleanEmail ? `heya:${cleanEmail}` : "heya:dashboard-admin";
};

const normalizeMcpAuthUrl = (value, settings = readMcpSettings()) => {
  const authUrl = cleanText(value);
  if (!authUrl) return "";
  if (/^https?:\/\//i.test(authUrl)) return authUrl;
  if (authUrl.startsWith("/")) {
    return new URL(authUrl, `${settings.endpoint}/`).toString();
  }
  return authUrl;
};

const requestMcpOauthStart = async ({
  provider,
  returnTo = "",
  state = "",
  dashboardUserEmail = "",
  dashboardPath = ""
} = {}) => {
  const settings = readMcpSettings();
  const safeProvider = String(provider || "").trim().toLowerCase();
  const targetPath = getMcpAuthStartPath(safeProvider, settings);
  const userId = dashboardMcpUserId(dashboardUserEmail);
  const cleanReturnTo = cleanText(returnTo);
  const cleanState = cleanText(state);

  const facebookCredentials = safeProvider === "facebook" && configuredFacebookAppId
    ? { appId: configuredFacebookAppId, clientSecret: configuredFacebookClientSecret }
    : {};

  const payload = {
    type: "oauth_start",
    provider: safeProvider,
    source: "heya-dashboard",
    permissions: settings.permissions,
    user: {
      id: userId,
      userId,
      email: dashboardUserEmail || ""
    },
    context: {
      serverLabel: settings.serverLabel,
      dashboardPath,
      returnTo: cleanReturnTo,
      state: cleanState
    },
    ...facebookCredentials
  };

  const result = await forwardMcpRequest({
    targetPath,
    method: "POST",
    payload,
    query: {
      returnTo: cleanReturnTo,
      state: cleanState,
      userId
    },
    redirect: "manual",
    requireEnabled: false
  });

  return {
    settings,
    provider: safeProvider,
    result,
    authUrl: normalizeMcpAuthUrl(extractAuthUrlFromResult(result), settings)
  };
};

const mcpSocialPostTools = new Set(["linkedin_post", "facebook_post", "tiktok_post"]);
const getMcpSocialProvider = (tool = "") => {
  const normalized = String(tool || "").toLowerCase();
  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized.includes("facebook") || normalized.includes("meta")) return "facebook";
  if (normalized.includes("tiktok")) return "tiktok";
  return "";
};

const getMcpPostText = (payload = {}) => cleanMultiline(payload.text || payload.content || payload.message || "");
const socialPostPromptPattern = /\b(post|publish|send|share)\b[\s\S]{0,80}\b(linkedin|facebook|meta)\b|\b(linkedin|facebook|meta)\b[\s\S]{0,80}\b(post|publish|send|share)\b/i;
const socialDesignPromptPattern = /\b(template|design|designed|brand|branded|banner|graphic|layout|poster|flyer|creative)\b/i;
const imageEditPromptPattern = /\b(edit|change|modify|retouch|enhance|improve|replace|remove|add|resize|crop|background|template|design|brand|branded|banner|graphic|layout|poster|flyer)\b/i;
const getSocialProviderFromPrompt = (value = "") => {
  const text = String(value || "").toLowerCase();
  if (text.includes("linkedin")) return "linkedin";
  if (text.includes("facebook") || text.includes("meta")) return "facebook";
  return "";
};
const getSocialPostCaptionFromPrompt = (value = "") => {
  const text = cleanMultiline(value);
  return text
    .replace(/^\s*(post|publish|send|share)\s+(this\s+)?(image\s+|photo\s+|picture\s+)?(to|on)\s+(linkedin|facebook|meta)\s*[:\-]?\s*/i, "")
    .replace(/^\s*(linkedin|facebook|meta)\s+(post|publish|send|share)\s*[:\-]?\s*/i, "")
    .trim() || text;
};
const buildMcpImageAttachment = (attachedFile = {}) => {
  if (!attachedFile?.contentBase64) return null;
  const filename = String(attachedFile.name || "attachment").replace(/[^\w.\-]/g, "_");
  const mimeType = String(attachedFile.type || "application/octet-stream").toLowerCase();
  return {
    filename,
    name: filename,
    mimeType,
    type: mimeType,
    contentBase64: attachedFile.contentBase64,
    altText: "HEYA Talent Solutions social post image"
  };
};
const buildMcpImageMediaMeta = (attachment = {}) => {
  if (!attachment) return null;
  return {
    type: "image",
    filename: attachment.filename || attachment.name || "image.jpg",
    name: attachment.name || attachment.filename || "image.jpg",
    mimeType: attachment.mimeType || attachment.type || "image/jpeg",
    altText: attachment.altText || "HEYA Talent Solutions social post image"
  };
};
const editAttachedImageWithOpenAI = async (attachedFile = {}, prompt = "") => {
  if (!openaiClient) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  if (!attachedFile?.contentBase64) {
    throw new Error("No attached image was provided.");
  }

  const filename = String(attachedFile.name || "image.png").replace(/[^\w.\-]/g, "_");
  const mimeType = String(attachedFile.type || "image/png").toLowerCase();
  const imageFile = await OpenAI.toFile(
    Buffer.from(attachedFile.contentBase64, "base64"),
    filename,
    { type: mimeType }
  );
  const editResult = await openaiClient.images.edit({
    model: process.env.OPENAI_IMAGE_EDIT_MODEL || "gpt-image-1",
    image: imageFile,
    prompt: cleanMultiline(prompt).slice(0, 4000),
    n: 1,
    size: "1024x1024",
    quality: "medium",
    output_format: "jpeg",
    output_compression: 70
  });
  const first = editResult.data?.[0] || {};
  const contentBase64 = first.b64_json || "";
  const imageUrl = first.url || (contentBase64 ? `data:image/jpeg;base64,${contentBase64}` : "");
  if (!imageUrl) {
    throw new Error("OpenAI did not return an edited image.");
  }

  return {
    imageUrl,
    contentBase64,
    filename: filename.replace(/\.[^.]+$/, "") + "-edited.jpg",
    mimeType: "image/jpeg",
    revisedPrompt: first.revised_prompt || ""
  };
};
const getMcpProviderLabel = (provider = "") => {
  const normalized = String(provider || "").toLowerCase();
  if (normalized === "linkedin") return "LinkedIn";
  if (normalized === "facebook") return "Facebook";
  if (normalized === "tiktok") return "TikTok";
  return "Social";
};
const isMcpSocialPostPlan = (plan = {}) => {
  const payload = plan?.payload && typeof plan.payload === "object" ? plan.payload : {};
  return plan?.path === "/execute" && mcpSocialPostTools.has(String(payload.tool || "").toLowerCase());
};

const describeMcpPlan = (plan = {}) => {
  const payload = plan?.payload && typeof plan.payload === "object" ? plan.payload : {};
  const provider = getMcpSocialProvider(payload.tool);
  if (provider) {
    return {
      type: "social_post",
      provider,
      tool: payload.tool,
      postText: getMcpPostText(payload)
    };
  }

  return {
    type: plan?.path === "/agent" ? "agent" : "tool",
    provider: "",
    tool: payload.tool || "",
    postText: ""
  };
};

const getMcpResultText = (result = {}) => [
  result.statusText,
  result.raw,
  result.data ? JSON.stringify(result.data) : ""
].filter(Boolean).join(" ");

const isMcpProviderUnavailable = (result = {}, provider = "") => {
  const text = getMcpResultText(result);
  if (!mcpProviderUnavailablePattern.test(text)) return false;
  if (!provider) return true;
  return new RegExp(provider, "i").test(text) || !/\b(facebook|linkedin|tiktok)\b/i.test(text);
};

const buildSocialPostSuccessMessage = (planSummary = {}) => {
  const label = getMcpProviderLabel(planSummary.provider);
  const postText = cleanMultiline(planSummary.postText);
  return [
    `Posted to ${label} successfully.`,
    postText ? "" : null,
    postText || null
  ].filter((line) => line !== null).join("\n");
};

const buildProviderUnavailableMessage = (planSummary = {}) => {
  const label = getMcpProviderLabel(planSummary.provider);
  const postText = cleanMultiline(planSummary.postText);
  return [
    `${label} posting is not installed or enabled on the MCP server yet, so I did not publish this post.`,
    postText ? "Here is the prepared draft:" : "Ask the MCP server owner to install or enable the integration, then try again.",
    postText || null
  ].filter((line) => line !== null).join("\n");
};

const fallbackMcpPromptPlan = (prompt, userId) => {
  const text = cleanMultiline(prompt);
  const lower = text.toLowerCase();
  const message = text
    .replace(/^\s*(post|publish|send)\s+(to|on)\s+(linkedin|facebook)\s*[:\-]?\s*/i, "")
    .trim() || text;

  if (lower.includes("linkedin")) {
    return {
      path: "/execute",
      method: "POST",
      payload: { tool: "linkedin_post", text: message, userId }
    };
  }

  if (lower.includes("facebook") || lower.includes("meta")) {
    return {
      path: "/execute",
      method: "POST",
      payload: { tool: "facebook_post", content: message, userId }
    };
  }

  return {
    path: "/agent",
    method: "POST",
    payload: { message: text, userId }
  };
};

const normalizeMcpPromptPlan = (plan, prompt, userId) => {
  const source = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
  const hasPayloadKey = Object.prototype.hasOwnProperty.call(source, "payload");
  const hasWrappedPayload = hasPayloadKey && source.payload && typeof source.payload === "object" && !Array.isArray(source.payload);
  let payload = hasPayloadKey
    ? (hasWrappedPayload ? { ...source.payload } : source.payload)
    : { ...source };
  const method = cleanText(source.method || "POST").toUpperCase() || "POST";
  let path = cleanText(source.path || source.targetPath || source.route || "");

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    delete payload.path;
    delete payload.targetPath;
    delete payload.route;
    delete payload.method;
    delete payload.payload;
  } else if (payload !== null && typeof payload !== "undefined") {
    payload = { value: payload };
  }

  if (!path) {
    path = payload?.tool ? "/execute" : "/agent";
  }
  path = ensureLeadingSlash(path);

  if (path === "/agent") {
    payload = {
      message: cleanMultiline(payload?.message || payload?.prompt || prompt),
      userId
    };
  } else if (payload !== null) {
    payload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    if (!payload.tool) payload.tool = "openai_chat";
    if (payload.tool === "linkedin_post" && !payload.text) payload.text = cleanMultiline(payload.content || prompt);
    if (payload.tool === "facebook_post" && !payload.content) payload.content = cleanMultiline(payload.text || prompt);
    if (payload.tool === "openai_chat" && !payload.message) payload.message = cleanMultiline(payload.text || payload.content || prompt);
    if (!payload.userId) payload.userId = userId;
  }

  return { path, method, payload };
};

const buildMcpPromptPlan = async (prompt, userId) => {
  const directJson = parseJsonLikePayload(prompt);
  if (directJson) {
    return {
      parserMode: "direct-json",
      plan: normalizeMcpPromptPlan(directJson, prompt, userId)
    };
  }

  if (openaiClient) {
    try {
      const completion = await openaiClient.responses.create({
        model: chatbotModel,
        max_output_tokens: 420,
        input: [
          {
            role: "system",
            content: [
              "You convert dashboard instructions into Roxanne MCP JSON.",
              "Return only JSON with path, method, and payload.",
              "Use /execute for tool calls and /agent for general assistant requests.",
              "LinkedIn posts use payload {\"tool\":\"linkedin_post\",\"text\":\"...\",\"userId\":\"USER_ID\"}.",
              "Facebook posts use payload {\"tool\":\"facebook_post\",\"content\":\"...\",\"userId\":\"USER_ID\"}.",
              "Do not include secrets or markdown."
            ].join(" ")
          },
          {
            role: "user",
            content: `USER_ID: ${userId}\nInstruction: ${cleanMultiline(prompt)}`
          }
        ]
      });

      const parsed = parseJsonLikePayload(completion.output_text || "");
      if (parsed) {
        return {
          parserMode: "openai",
          plan: normalizeMcpPromptPlan(parsed, prompt, userId)
        };
      }
    } catch (error) {
      console.error("[RoxanneAI MCP Parser] OpenAI parse failed:", error?.message || error);
    }
  }

  return {
    parserMode: openaiClient ? "fallback" : "fallback-no-openai",
    plan: normalizeMcpPromptPlan(fallbackMcpPromptPlan(prompt, userId), prompt, userId)
  };
};

const respondWithError = (res, status, error, fields = []) => {
  res.status(status).json({ ok: false, error, fields });
};

const adminToken = process.env.SUBMISSIONS_TOKEN || process.env.ADMIN_TOKEN || "";
const submissionsSessionCookieName = process.env.SESSION_COOKIE_NAME || "heya_admin_session";
const sessionMaxAgeSeconds = Number(process.env.SESSION_MAX_AGE_SECONDS || 28800);
const sessionMaxAgeMs = (Number.isFinite(sessionMaxAgeSeconds) && sessionMaxAgeSeconds > 0
  ? sessionMaxAgeSeconds
  : 28800) * 1000;
const sessionSecret = process.env.SESSION_SECRET || adminToken || (isProduction ? "" : "dev-heya-talent-solutions-session-secret");
const dashboardAdminEmail = cleanText(process.env.DASHBOARD_ADMIN_EMAIL).toLowerCase();
const dashboardAdminPassword = String(process.env.DASHBOARD_ADMIN_PASSWORD || "").trim();
const dashboardJwtSecret = String(process.env.JWT_SECRET || process.env.SESSION_SECRET || "");
const dashboardSessionCookieName = process.env.DASHBOARD_SESSION_COOKIE_NAME || "heya_dashboard_session";
const dashboardSessionDurationSeconds = Number(process.env.DASHBOARD_SESSION_DURATION || 43200);
const dashboardSessionDurationMs = (Number.isFinite(dashboardSessionDurationSeconds) && dashboardSessionDurationSeconds > 0
  ? dashboardSessionDurationSeconds
  : 43200) * 1000;
const dashboardSessionIssuer = "heya-talent-solutions";
const dashboardSessionAudience = "heya-dashboard";
const dashboardRefreshIntervalMs = (() => {
  const value = Number(process.env.DASHBOARD_REFRESH_INTERVAL_MS || 30000);
  if (!Number.isFinite(value) || value < 5000) return 30000;
  return value;
})();
const dashboardLoginSlug = cleanText(process.env.DASHBOARD_LOGIN_SLUG) || "login";
const dashboardLoginPath = `/dashboard-access/${dashboardLoginSlug}`;
const parseDashboardLimit = (value, fallback, max = 500) => {
  const next = Number.parseInt(value, 10);
  if (!Number.isInteger(next) || next <= 0) return fallback;
  return Math.min(next, max);
};
const logDashboardTiming = (route, startTime, count, extra = "") => {
  const suffix = extra ? ` ${extra}` : "";
  console.log(`[dashboard] ${route} returned ${count} records in ${Date.now() - startTime}ms${suffix}`);
};

const parseCookies = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (!rawName || !rawValue.length) return cookies;

    try {
      cookies[rawName] = decodeURIComponent(rawValue.join("="));
    } catch {
      cookies[rawName] = rawValue.join("=");
    }

    return cookies;
  }, {});
};

const signValue = (value) => crypto
  .createHmac("sha256", sessionSecret)
  .update(value)
  .digest("base64url");

const signJwtValue = (value) => crypto
  .createHmac("sha256", dashboardJwtSecret)
  .update(value)
  .digest("base64url");

const dashboardRequestFingerprint = (req) => {
  if (!dashboardJwtSecret) return "";
  const userAgent = cleanText(req.get("user-agent") || "unknown");
  return crypto
    .createHmac("sha256", dashboardJwtSecret)
    .update(userAgent)
    .digest("base64url");
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const createSignedSubmissionSession = () => {
  const payload = Buffer.from(JSON.stringify({
    scope: "submissions",
    exp: Date.now() + sessionMaxAgeMs
  })).toString("base64url");

  return `${payload}.${signValue(payload)}`;
};

const verifySignedSubmissionSession = (value) => {
  if (!sessionSecret || !value) return false;

  const [payload, signature] = String(value).split(".");
  if (!payload || !signature || !safeEqual(signValue(payload), signature)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.scope === "submissions" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
};

const base64Json = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const createDashboardSessionToken = ({ email, redirectTo, req } = {}) => {
  if (!dashboardJwtSecret) return "";

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Json({ alg: "HS256", typ: "JWT", kid: "dashboard-v1" });
  const payload = base64Json({
    sub: email,
    scope: "dashboard",
    aud: dashboardSessionAudience,
    iss: dashboardSessionIssuer,
    jti: crypto.randomUUID(),
    fp: req ? dashboardRequestFingerprint(req) : "",
    redirectTo: cleanText(redirectTo),
    iat: issuedAt,
    exp: Math.floor((Date.now() + dashboardSessionDurationMs) / 1000)
  });
  const signature = signJwtValue(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
};

const verifyDashboardSessionToken = (token, req) => {
  if (!dashboardJwtSecret || !token) return null;

  const [header, payload, signature] = String(token).split(".");
  if (!header || !payload || !signature || !safeEqual(signJwtValue(`${header}.${payload}`), signature)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const expiresAt = Number(data.exp) * 1000;
    const issuedAt = Number(data.iat) * 1000;
    const expectedFingerprint = req ? dashboardRequestFingerprint(req) : "";
    if (
      data.scope !== "dashboard"
      || data.aud !== dashboardSessionAudience
      || data.iss !== dashboardSessionIssuer
      || !data.sub
      || !data.jti
      || !Number.isFinite(expiresAt)
      || expiresAt <= Date.now()
      || !Number.isFinite(issuedAt)
      || issuedAt > Date.now() + 60000
      || (expectedFingerprint && data.fp !== expectedFingerprint)
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const hasValidAdminToken = (req) => {
  return Boolean(adminToken) && (req.query.token === adminToken || req.get("x-admin-token") === adminToken);
};

const hasValidAdminSession = (req) => {
  const cookies = parseCookies(req.get("cookie"));
  return verifySignedSubmissionSession(cookies[submissionsSessionCookieName]);
};

const setAdminSessionCookie = (res) => {
  if (!sessionSecret) return;

  res.cookie(submissionsSessionCookieName, createSignedSubmissionSession(), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: sessionMaxAgeMs,
    path: "/"
  });
};

const clearDashboardSessionCookie = (res) => {
  res.clearCookie(dashboardSessionCookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/"
  });
};

const setDashboardSessionCookie = (res, token) => {
  res.cookie(dashboardSessionCookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: dashboardSessionDurationMs,
    path: "/"
  });
};

const getDashboardSession = (req) => {
  const cookies = parseCookies(req.get("cookie"));
  return verifyDashboardSessionToken(cookies[dashboardSessionCookieName], req);
};

const isDashboardConfigured = () => Boolean(dashboardAdminEmail && dashboardAdminPassword && dashboardJwtSecret && sessionSecret);
const getDashboardLoginPath = () => dashboardLoginPath;

const setDashboardNoStoreHeaders = (res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
};

const buildDashboardLoginUrl = (req) => {
  const nextPath = req.originalUrl && (/^\/(?:dashboard|admin-dashboard)(?:\/|$)/).test(req.originalUrl)
    ? req.originalUrl
    : "/dashboard/";
  return `${getDashboardLoginPath()}?next=${encodeURIComponent(nextPath)}`;
};

const requireDashboardAuth = (req, res, next) => {
  setDashboardNoStoreHeaders(res);

  if (!isDashboardConfigured()) {
    clearDashboardSessionCookie(res);
    if (req.path.startsWith("/api/")) {
      return res.status(503).json({ ok: false, error: "Dashboard authentication is not configured.", redirectTo: getDashboardLoginPath() });
    }
    return res.redirect(302, buildDashboardLoginUrl(req));
  }

  const session = getDashboardSession(req);
  if (session) {
    req.dashboardUser = { email: session.sub, sessionId: session.jti };
    return next();
  }

  clearDashboardSessionCookie(res);

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ ok: false, error: "Dashboard authentication required.", redirectTo: getDashboardLoginPath() });
  }

  return res.redirect(302, buildDashboardLoginUrl(req));
};

const isDashboardProtectedPath = (requestPath = "") => {
  const routePath = String(requestPath || "");
  if (!routePath) return false;
  if (routePath === getDashboardLoginPath()) return false;
  if (routePath.startsWith("/api/dashboard/auth/")) return false;

  return routePath === "/dashboard"
    || routePath.startsWith("/dashboard/")
    || routePath === "/admin-dashboard"
    || routePath.startsWith("/admin-dashboard/")
    || routePath === "/dashboard-assets"
    || routePath.startsWith("/dashboard-assets/")
    || routePath.startsWith("/api/admin/")
    || routePath.startsWith("/api/admin-dashboard/")
    || routePath === "/api/settings/account"
    || routePath.startsWith("/api/settings/account/")
    || routePath === "/api/mcp/proxy"
    || routePath.startsWith("/api/mcp/proxy/");
};

const enforceDashboardAuth = (req, res, next) => {
  if (!isDashboardProtectedPath(req.path)) {
    return next();
  }

  return requireDashboardAuth(req, res, next);
};

const canViewSubmissions = (req) => {
  return hasValidAdminSession(req) || (!adminToken && !isProduction);
};

const requireSubmissionsAccess = (req, res, next) => {
  if (canViewSubmissions(req)) {
    return next();
  }

  if (hasValidAdminToken(req)) {
    setAdminSessionCookie(res);
    if (req.query.token && !req.path.startsWith("/api/")) {
      return res.redirect(303, req.path);
    }

    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(403).json({ ok: false, error: "Admin access required." });
  }

  res.status(403);
  return render(res, "404", { active: "", pageTitle: "Page Not Found | HEYA Talent Solutions" });
};

app.use(enforceDashboardAuth);

const getSubmissionDashboardData = () => ({
  counts: dbOps.getSubmissionCounts(),
  contactEnquiries: dbOps.getRecentContactEnquiries(50),
  vacancyEnquiries: dbOps.getRecentVacancyEnquiries(50),
  tokenRequired: Boolean(adminToken)
});

const deliverEnquiryEmails = async (payload, type) => {
  try {
    const result = await sendEnquiryEmails(payload, type);
    if (result?.skipped) {
      console.warn(`[Email] Skipped ${type} notification: ${result.reason}`);
    } else if (!result?.ok) {
      console.error(`[Email] Failed ${type} notification: ${result?.error || "unknown_error"}`);
    }
    return result;
  } catch (err) {
    console.error("[Email Error]", err);
    return { ok: false, skipped: false, error: err?.message || "email_error" };
  }
};

const emailStatusForResponse = (result) => {
  if (result?.ok && !result?.skipped) return "sent";
  if (result?.skipped) return "not_configured";
  return "failed";
};

const hrMailbox = () => cleanText(process.env.CAREERS_HR_EMAIL || process.env.BUSINESS_EMAIL || "");
const advertisingMailbox = () => cleanText(process.env.CAREERS_ADVERTISING_EMAIL || process.env.BUSINESS_EMAIL || "");

const deliverCareersEmail = async (message) => {
  try {
    return await sendCareersMailboxNotification(message);
  } catch (error) {
    console.error("[Careers Email Error]", error);
    return { ok: false, skipped: false, error: error?.message || "email_error" };
  }
};

const isApplicationInboxRequest = (payload = {}) => {
  const service = cleanText(payload.serviceNeeded).toLowerCase();
  const intent = cleanText(payload.careerIntent).toLowerCase();
  return service === "job application / cv submission"
    || intent === "job-application"
    || intent === "jobseeker-cv"
    || Boolean(payload.cvUpload);
};

const inboxKindFor = (payload = {}) => {
  const intent = cleanText(payload.careerIntent).toLowerCase();
  if (intent === "jobseeker-cv") return "cv-submission";
  if (intent === "job-application" || payload.jobPostingId) return "job-application";
  return payload.cvUpload ? "cv-submission" : "job-application";
};

const safeCreateInboxMessage = (payload) => {
  try {
    return careersDb.createInboxMessage(payload);
  } catch (error) {
    console.error("[Dashboard Inbox Error]", error);
    return null;
  }
};

app.post("/api/contact", async (req, res) => {
  const required = ["fullName", "email", "phone", "serviceNeeded", "message"];
  const missingFields = missing(required, req.body);
  if (missingFields.length) {
    return respondWithError(res, 400, "Please complete all required fields.", missingFields);
  }

  const payload = {
    fullName: cleanText(req.body.fullName),
    companyName: cleanText(req.body.companyName),
    email: normalizeEmail(req.body.email),
    phone: cleanText(req.body.phone),
    serviceNeeded: cleanText(req.body.serviceNeeded),
    careerIntent: cleanText(req.body.careerIntent),
    jobPostingId: cleanText(req.body.jobPostingId),
    currentLocation: cleanText(req.body.currentLocation),
    yearsExperience: cleanText(req.body.yearsExperience),
    desiredRoles: cleanText(req.body.desiredRoles),
    industries: cleanText(req.body.industries),
    cvUpload: req.body.cvUpload,
    coverLetterUpload: req.body.coverLetterUpload,
    message: cleanMultiline(req.body.message),
    ...requestMeta(req)
  };

  if (!isEmail(payload.email)) {
    return respondWithError(res, 400, "Please enter a valid email address.", ["email"]);
  }

  try {
    const result = dbOps.saveContactEnquiry(payload);
    const id = Number(result.lastInsertRowid);

    const emailResult = await deliverEnquiryEmails({ ...payload, id }, "contact");
    const inboxMessage = isApplicationInboxRequest(payload)
      ? safeCreateInboxMessage({
          ...payload,
          kind: inboxKindFor(payload),
          subject: payload.jobPostingId ? "Job application from contact form" : "Job Application / CV Submission",
          linkedContactEnquiryId: id
        })
      : null;

    res.status(201).json({
      ok: true,
      id,
      inboxMessageId: inboxMessage?.id || null,
      emailStatus: emailStatusForResponse(emailResult),
      message: "Thank you. Your enquiry has been received."
    });
  } catch (err) {
    console.error("Contact DB error:", err);
    respondWithError(res, 500, "Failed to save enquiry.");
  }
});

app.get("/api/careers/jobs/:id", (req, res) => {
  const job = careersDb.getJobPosting(Number(req.params.id));
  if (!job || job.status !== "published") {
    return res.status(404).json({ ok: false, error: "Position not found." });
  }
  res.json({ ok: true, job });
});

app.get("/api/careers/jobs", (_req, res) => {
  const careerData = careersPageData();
  res.json({
    ok: true,
    jobs: careerData.jobs,
    filters: careerData.filters,
    stats: careerData.stats
  });
});

app.post(["/api/advertise", "/api/apply", "/api/careers/employer-submissions"], async (req, res) => {
  const required = ["fullName", "companyName", "jobTitle", "location", "phone", "email"];
  const missingFields = missing(required, req.body);
  if (!cleanText(req.body.industry) && !cleanText(req.body.jobCategory)) {
    missingFields.push("jobCategory");
  }
  if (missingFields.length) {
    return respondWithError(res, 400, "Please complete all required fields.", missingFields);
  }

  const payload = {
    fullName: cleanText(req.body.fullName),
    companyAddress: cleanMultiline(req.body.companyAddress),
    companyName: cleanText(req.body.companyName),
    jobTitle: cleanText(req.body.jobTitle),
    industry: cleanText(req.body.industry || req.body.jobCategory),
    jobCategory: cleanText(req.body.jobCategory || req.body.industry),
    numberOfVacancies: cleanText(req.body.numberOfVacancies),
    location: cleanText(req.body.location),
    employmentType: cleanText(req.body.employmentType),
    phone: cleanText(req.body.phone),
    email: normalizeEmail(req.body.email),
    contactPersonRole: cleanText(req.body.contactPersonRole),
    packageInterest: cleanText(req.body.packageInterest),
    salaryDisplay: cleanText(req.body.salaryDisplay),
    applicationDeadline: cleanText(req.body.applicationDeadline),
    jobDescription: cleanMultiline(req.body.jobDescription),
    jobCriteria: cleanMultiline(req.body.jobCriteria),
    minimumQualifications: cleanMultiline(req.body.minimumQualifications),
    requiredExperience: cleanMultiline(req.body.requiredExperience),
    requiredSkills: cleanText(req.body.requiredSkills),
    applicationInstructions: cleanMultiline(req.body.applicationInstructions),
    applicationInstructionsUpload: req.body.applicationInstructionsUpload || null,
    supportingNotes: cleanMultiline(req.body.supportingNotes),
    additionalMessage: cleanMultiline(req.body.additionalMessage),
    message: cleanMultiline(req.body.message || req.body.additionalMessage),
    careerSiteUrl: cleanText(req.body.careerSiteUrl) || null,
    ...requestMeta(req)
  };

  if (!isEmail(payload.email)) {
    return respondWithError(res, 400, "Please enter a valid email address.", ["email"]);
  }

  try {
    const submission = careersDb.createEmployerSubmission(payload);
    const emailResult = await deliverCareersEmail({
      toEmail: advertisingMailbox(),
      subject: `HEYA Talent Solutions: Employer vacancy request ${submission.submission_code}`,
      heading: "New employer vacancy request",
      replyTo: { email: payload.email, name: payload.fullName },
      customerEmail: payload.email,
      customerName: payload.fullName,
      acknowledgmentSubject: "HEYA Talent Solutions: Your vacancy request was received",
      acknowledgmentMessage: "Your vacancy advertising request has been received by the HEYA Talent Solutions team. We will review it and follow up with the next steps.",
      rows: [
        { label: "Request code", value: submission.submission_code },
        { label: "Contact", value: payload.fullName },
        { label: "Company", value: payload.companyName },
        { label: "Role", value: payload.jobTitle },
        { label: "Industry", value: payload.industry },
        { label: "Location", value: payload.location },
        { label: "Employment type", value: payload.employmentType },
        { label: "Deadline", value: payload.applicationDeadline || "Not provided" },
        { label: "Phone", value: payload.phone },
        { label: "Email", value: payload.email },
        { label: "Job description", value: payload.jobDescription || "Not provided" },
        { label: "Criteria", value: payload.jobCriteria || "Not provided" },
        { label: "Minimum qualifications", value: payload.minimumQualifications || "Not provided" },
        { label: "Required experience", value: payload.requiredExperience || "Not provided" },
        { label: "Required skills", value: payload.requiredSkills || "Not provided" },
        { label: "Application instructions", value: submission.appInstrFileName || payload.applicationInstructions || "Not provided" },
        { label: "Supporting notes", value: payload.supportingNotes || "Not provided" },
        { label: "Additional message", value: payload.additionalMessage || "Not provided" },
        { label: "Company career site URL", value: payload.careerSiteUrl || "Not provided — HEYA will receive applications directly" }
      ]
    });

    res.status(201).json({
      ok: true,
      id: submission.id,
      code: submission.submission_code,
      emailStatus: emailStatusForResponse(emailResult),
      message: "Your vacancy request has been submitted."
    });
  } catch (err) {
    console.error("Employer submission error:", err);
    respondWithError(res, 500, err?.message || "Failed to save vacancy request.");
  }
});

app.post("/api/careers/talent-pool", async (req, res) => {
  const required = ["fullName", "email", "phone"];
  const missingFields = missing(required, req.body);
  if (missingFields.length) {
    return respondWithError(res, 400, "Please complete all required fields.", missingFields);
  }

  if (!req.body.cvUpload) {
    return respondWithError(res, 400, "Please upload your CV to continue.", ["cvUpload"]);
  }

  const payload = {
    fullName: cleanText(req.body.fullName),
    email: normalizeEmail(req.body.email),
    phone: cleanText(req.body.phone),
    currentLocation: cleanText(req.body.currentLocation),
    yearsExperience: cleanText(req.body.yearsExperience || req.body.workExperienceSummary),
    desiredRoles: cleanText(req.body.desiredRoles || req.body.jobType),
    industries: cleanText(req.body.industries || req.body.preferredIndustry),
    preferredWorkLocation: cleanText(req.body.preferredWorkLocation),
    highestQualification: cleanText(req.body.highestQualification),
    keySkills: cleanText(req.body.keySkills),
    availability: cleanText(req.body.availability),
    coverLetterText: cleanMultiline(req.body.coverLetterText),
    additionalNotes: cleanMultiline(req.body.additionalNotes),
    message: cleanMultiline(req.body.message || req.body.workExperienceSummary || req.body.additionalNotes),
    cvUpload: req.body.cvUpload,
    coverLetterUpload: req.body.coverLetterUpload,
    ...requestMeta(req)
  };

  if (!isEmail(payload.email)) {
    return respondWithError(res, 400, "Please enter a valid email address.", ["email"]);
  }

  try {
    const submission = careersDb.createTalentPoolSubmission(payload);
    const emailResult = await deliverCareersEmail({
      toEmail: hrMailbox(),
      subject: `HEYA Talent Solutions: Talent pool submission ${submission.submissionCode}`,
      heading: "New talent pool submission",
      replyTo: { email: payload.email, name: payload.fullName },
      customerEmail: payload.email,
      customerName: payload.fullName,
      acknowledgmentSubject: "HEYA Talent Solutions: Your CV was added to our talent pool",
      acknowledgmentMessage: "Your CV and profile have been received for the HEYA Talent Solutions talent pool. We will contact you when a suitable opportunity is available.",
      rows: [
        { label: "Submission code", value: submission.submissionCode },
        { label: "Candidate", value: payload.fullName },
        { label: "Desired roles", value: payload.desiredRoles || "Not provided" },
        { label: "Industries", value: payload.industries || "Not provided" },
        { label: "Location", value: payload.currentLocation || "Not provided" },
        { label: "Experience", value: payload.yearsExperience || "Not provided" },
        { label: "Preferred work location", value: payload.preferredWorkLocation || "Not provided" },
        { label: "Highest qualification", value: payload.highestQualification || "Not provided" },
        { label: "Key skills", value: payload.keySkills || "Not provided" },
        { label: "Availability", value: payload.availability || "Not provided" },
        { label: "CV", value: submission.cvName || "Uploaded" },
        { label: "Cover letter", value: submission.coverLetterName || payload.coverLetterText || "Not provided" }
      ]
    });
    const inboxMessage = safeCreateInboxMessage({
      ...payload,
      kind: "cv-submission",
      subject: `Talent pool CV submission ${submission.submissionCode}`,
      cvFileId: submission.cvFile?.id,
      coverLetterFileId: submission.coverLetterFile?.id,
      linkedTalentPoolSubmissionId: submission.id,
      receivedAt: submission.createdAt
    });

    res.status(201).json({
      ok: true,
      id: submission.id,
      code: submission.submissionCode,
      inboxMessageId: inboxMessage?.id || null,
      emailStatus: emailStatusForResponse(emailResult),
      message: "Your CV has been added to the HEYA Talent Solutions talent pool."
    });
  } catch (err) {
    console.error("Talent pool submission error:", err);
    respondWithError(res, 400, err?.message || "Failed to save talent pool submission.");
  }
});

app.get("/api/careers/image/:fileId", (req, res) => {
  const file = careersDb.getPublicJobImage(Number(req.params.fileId));
  if (!file || !fs.existsSync(file.absolutePath)) {
    return res.status(404).end();
  }
  res.setHeader("Content-Type", file.mime_type || "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(file.absolutePath);
});

app.post("/api/careers/jobs/:id/apply", async (req, res) => {
  const required = ["fullName", "email", "phone"];
  const missingFields = missing(required, req.body);
  if (missingFields.length) {
    return respondWithError(res, 400, "Please complete all required fields.", missingFields);
  }

  if (!req.body.cvUpload) {
    return respondWithError(res, 400, "Please attach your CV.", ["cvUpload"]);
  }

  if (!req.body.idPhotoUpload) {
    return respondWithError(res, 400, "Please attach your ID photo.", ["idPhotoUpload"]);
  }

  const posting = careersDb.getJobPosting(Number(req.params.id));
  if (posting?.coverLetterRequired && !req.body.coverLetterUpload && !cleanMultiline(req.body.coverLetterText)) {
    return respondWithError(res, 400, "Please attach or write the required cover letter.", ["coverLetterUpload", "coverLetterText"]);
  }

  const payload = {
    fullName: cleanText(req.body.fullName),
    email: normalizeEmail(req.body.email),
    phone: cleanText(req.body.phone),
    currentLocation: cleanText(req.body.currentLocation),
    yearsExperience: cleanText(req.body.yearsExperience),
    message: cleanMultiline(req.body.message),
    coverLetterText: cleanMultiline(req.body.coverLetterText),
    cvUpload: req.body.cvUpload,
    coverLetterUpload: req.body.coverLetterUpload,
    idPhotoUpload: req.body.idPhotoUpload,
    ...requestMeta(req)
  };

  if (!isEmail(payload.email)) {
    return respondWithError(res, 400, "Please enter a valid email address.", ["email"]);
  }

  try {
    const application = careersDb.createJobApplication(Number(req.params.id), payload);
    const emailResult = await deliverCareersEmail({
      toEmail: hrMailbox(),
      subject: `HEYA Talent Solutions: Job application ${application.applicationCode}`,
      heading: "New job application received",
      replyTo: { email: payload.email, name: payload.fullName },
      customerEmail: payload.email,
      customerName: payload.fullName,
      acknowledgmentSubject: `HEYA Talent Solutions: Application received for ${application.positionTitle}`,
      acknowledgmentMessage: `Your application for ${application.positionTitle} has been received by HEYA Talent Solutions. Our team will review it and contact you if you are shortlisted.`,
      rows: [
        { label: "Application code", value: application.applicationCode },
        { label: "Candidate", value: payload.fullName },
        { label: "Role", value: application.positionTitle },
        { label: "Company", value: application.companyName || "HEYA Talent Solutions client" },
        { label: "Location", value: payload.currentLocation || "Not provided" },
        { label: "Experience", value: payload.yearsExperience || "Not provided" },
        { label: "CV", value: application.cvName || "Uploaded" },
        { label: "Cover letter", value: application.coverLetterName || "Not provided" }
      ]
    });
    const inboxMessage = safeCreateInboxMessage({
      ...payload,
      kind: "job-application",
      subject: `Application for ${application.positionTitle}`,
      positionId: application.positionId,
      positionTitle: application.positionTitle,
      cvFileId: application.cvFile?.id,
      coverLetterFileId: application.coverLetterFile?.id,
      linkedApplicationId: application.id,
      receivedAt: application.appliedAt
    });

    res.status(201).json({
      ok: true,
      id: application.id,
      code: application.applicationCode,
      inboxMessageId: inboxMessage?.id || null,
      emailStatus: emailStatusForResponse(emailResult),
      message: "Your application has been submitted."
    });

    /* ── Pipedrive: push applicant as Person + create Deal (fire-and-forget, only when toggle ON) ── */
    setImmediate(async () => {
      try {
        if (!getPdEnabled()) return;
        const pdKey = getPdApiKey();
        if (!pdKey) return;
        // Deduplicate by email — reuse existing Person if found
        const existing = await findPdPersonByEmail(payload.email, pdKey);
        const personId = existing?.id || await pdPushPerson(payload.fullName, payload.email, payload.phone);
        if (!personId) return;
        // Inherit the job posting's Org if it already has one
        const pdJob = careersDb.getJobPostingPdIds(application.positionId);
        const dealTitle = `${payload.fullName} — ${application.positionTitle}`;
        const dealId = await pdCreateDeal(dealTitle, personId, pdJob?.orgId || null, PD_STAGE_MAP.applied);
        careersDb.storePdApplicationIds(application.id, personId, dealId);
        console.log(`[pipedrive] new applicant id=${application.id} → person=${personId} deal=${dealId}`);
      } catch (err) {
        console.warn(`[pipedrive] auto-push error: ${err.message}`);
      }
    });
  } catch (err) {
    console.error("Job application error:", err);
    respondWithError(res, 400, err?.message || "Failed to submit application.");
  }
});

app.get(dashboardLoginPath, (req, res) => {
  setDashboardNoStoreHeaders(res);
  const session = getDashboardSession(req);
  if (session) {
    return res.redirect(302, cleanText(req.query.next) || "/dashboard/");
  }

  render(res, "dashboard-login", {
    active: "",
    bodyId: "page-dashboard-login",
    pageTitle: "Dashboard Login | HEYA Talent Solutions",
    pageDescription: "Secure login portal for the HEYA Talent Solutions dashboard.",
    loginConfig: {
      configured: isDashboardConfigured(),
      next: cleanText(req.query.next) || "/dashboard/"
    }
  });
});

app.get("/dashboard/login", (_req, res) => {
  res.status(404);
  render(res, "404", { active: "", pageTitle: "Page Not Found | HEYA Talent Solutions" });
});

app.get("/admin-dashboard/login", (req, res) => {
  res.status(404);
  render(res, "404", { active: "", pageTitle: "Page Not Found | HEYA Talent Solutions" });
});

app.post("/api/dashboard/auth/login", (req, res) => {
  setDashboardNoStoreHeaders(res);
  const email = cleanText(req.body.email).toLowerCase();
  const password = String(req.body.password || "").trim();
  const next = cleanText(req.body.next) || "/dashboard/";

  if (!isDashboardConfigured()) {
    return respondWithError(res, 503, "Dashboard authentication is not configured.");
  }

  if (!email || !password) {
    return respondWithError(res, 400, "Email and password are required.", ["email", "password"]);
  }

  const emailMatches = safeEqual(email, dashboardAdminEmail);
  const passwordMatches = safeEqual(password, dashboardAdminPassword);

  if (!emailMatches || !passwordMatches) {
    clearDashboardSessionCookie(res);
    return respondWithError(res, 401, "Invalid email or password.", ["email", "password"]);
  }

  const token = createDashboardSessionToken({ email, req });
  setDashboardSessionCookie(res, token);
  const safeNext = (/^\/(?:dashboard|admin-dashboard)(?:\/|$)/).test(next) ? next : "/dashboard/";
  res.json({
    ok: true,
    redirectTo: safeNext,
    message: "Authentication successful."
  });
});

app.post("/api/dashboard/auth/logout", (_req, res) => {
  setDashboardNoStoreHeaders(res);
  clearDashboardSessionCookie(res);
  res.json({ ok: true, redirectTo: getDashboardLoginPath(), message: "Logged out." });
});

app.get("/api/dashboard/auth/status", (req, res) => {
  setDashboardNoStoreHeaders(res);
  const session = getDashboardSession(req);
  if (!session) {
    clearDashboardSessionCookie(res);
    return res.status(401).json({ ok: false, authenticated: false, redirectTo: getDashboardLoginPath() });
  }

  res.json({ ok: true, authenticated: true, email: session.sub });
});

app.get("/api/admin/careers/dashboard", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const includeNotifications = cleanText(req.query.includeNotifications || "true").toLowerCase() !== "false";
  const payload = careersDb.getDashboardData({
    includeNotifications,
    notificationsLimit: parseDashboardLimit(req.query.notificationsLimit, 50, 200),
    applicationsLimit: parseDashboardLimit(req.query.applicationsLimit, null, 500),
    employerSubmissionsLimit: parseDashboardLimit(req.query.employerSubmissionsLimit, null, 500),
    talentPoolLimit: parseDashboardLimit(req.query.talentPoolLimit, null, 500)
  });
  const count = (payload.positions?.length || 0)
    + (payload.applicants?.length || 0)
    + (payload.talentPool?.length || 0)
    + (payload.employerSubmissions?.length || 0)
    + (payload.notifications?.length || 0);
  logDashboardTiming("/api/admin/careers/dashboard", start, count, `(notifications=${includeNotifications})`);
  res.json({ ok: true, ...payload });
});

app.get("/api/admin/careers/offers", requireDashboardAuth, (req, res) => {
  const status = cleanText(req.query.status).toLowerCase() || "all";
  const offers = careersDb.listOffers({ status });
  res.json({ ok: true, offers, status, count: offers.length });
});

app.get("/api/admin/dashboard/refresh-config", requireDashboardAuth, (_req, res) => {
  res.json({
    ok: true,
    intervalMs: dashboardRefreshIntervalMs
  });
});

/* ── Database Integrity Check ─────────────────────────────────────────────── */
app.get("/api/admin/db/integrity-check", requireDashboardAuth, (_req, res) => {
  try {
    const result = careersDb.integrityCheck();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[integrity-check]", err);
    return respondWithError(res, 500, "Integrity check failed: " + (err.message || "Unknown error."));
  }
});

/* ── Application Stage History ────────────────────────────────────────────── */
app.get("/api/admin/careers/applications/:id/stage-history", requireDashboardAuth, (req, res) => {
  try {
    const history = careersDb.listApplicationStageHistory(req.params.id);
    res.json({ ok: true, history });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to fetch stage history.");
  }
});

/* ── Rejection Reasons ────────────────────────────────────────────────────── */
app.get("/api/admin/careers/rejection-reasons", requireDashboardAuth, (_req, res) => {
  try {
    const reasons = careersDb.listRejectionReasons();
    res.json({ ok: true, reasons });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to fetch rejection reasons.");
  }
});

/* ── Offer Records ────────────────────────────────────────────────────────── */
app.get("/api/admin/careers/applications/:id/offers", requireDashboardAuth, (req, res) => {
  try {
    const offers = careersDb.listOfferRecords({ applicationId: req.params.id });
    res.json({ ok: true, offers });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to fetch offer records.");
  }
});

/* ── Application email history / duplicate detection (Item 9) ─────────── */
app.get("/api/admin/careers/applications/:id/email-history", requireDashboardAuth, (req, res) => {
  try {
    const appId = Number(req.params.id);
    const application = careersDb.listApplications().find((a) => a.id === appId || Number(a.id) === appId);
    if (!application) return respondWithError(res, 404, "Application not found.");
    const normalizedEmail = String(application.normalizedEmail || application.email || "").toLowerCase().trim();
    if (!normalizedEmail) return res.json({ ok: true, history: [] });
    const history = careersDb.getApplicationEmailHistory(normalizedEmail, appId);
    res.json({ ok: true, history });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to fetch email history.");
  }
});

app.get("/api/admin/careers/duplicates/summary", requireDashboardAuth, (_req, res) => {
  try {
    const summary = careersDb.getDuplicateSummary();
    res.json({ ok: true, ...summary });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to fetch duplicate summary.");
  }
});

/* ── Reporting metrics (Item 10) ─────────────────────────────────────────── */
app.get("/api/admin/reports/metrics", requireDashboardAuth, (_req, res) => {
  try {
    const metrics = careersDb.getReportingMetrics();
    res.json({ ok: true, metrics });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to fetch reporting metrics.");
  }
});

/* ── Talent pool active tools (Item 8) ──────────────────────────────────── */
app.patch("/api/admin/careers/talent-pool/:id/tags", requireDashboardAuth, (req, res) => {
  try {
    const { tags } = req.body || {};
    careersDb.updateTalentPoolTags(req.params.id, tags || []);
    res.json({ ok: true });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to update talent pool tags.");
  }
});

app.post("/api/admin/careers/talent-pool/:id/mark-contacted", requireDashboardAuth, (req, res) => {
  try {
    careersDb.markTalentPoolContacted(req.params.id);
    res.json({ ok: true, lastContactedAt: new Date().toISOString() });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to mark talent as contacted.");
  }
});

/* ── Application Files (with verification status) ─────────────────────── */
app.get("/api/admin/careers/applications/:id/files", requireDashboardAuth, (req, res) => {
  try {
    const files = careersDb.getApplicationFilesWithVerification(req.params.id);
    res.json({ ok: true, files });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to fetch application files.");
  }
});

/* ── File Verification Update ─────────────────────────────────────────── */
app.patch("/api/admin/careers/files/:fileId/verification", requireDashboardAuth, (req, res) => {
  try {
    const { verificationStatus, verificationNotes } = req.body || {};
    if (!verificationStatus) return respondWithError(res, 400, "verificationStatus is required.");
    careersDb.updateFileVerification(req.params.fileId, {
      verificationStatus: cleanText(verificationStatus),
      verifiedBy: "admin",
      verificationNotes: cleanText(verificationNotes) || ""
    });
    res.json({ ok: true });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to update file verification.");
  }
});

/* ── Application Rejection Reason ────────────────────────────────────── */
app.patch("/api/admin/careers/applications/:id/rejection", requireDashboardAuth, (req, res) => {
  try {
    const { rejectionReasonId, rejectionNotes } = req.body || {};
    careersDb.setApplicationRejectionReason(req.params.id, {
      rejectionReasonId: rejectionReasonId || null,
      rejectionNotes: cleanText(rejectionNotes) || ""
    });
    res.json({ ok: true });
  } catch (err) {
    return respondWithError(res, 500, err.message || "Unable to save rejection reason.");
  }
});

// ----- Parse a job-description document and return structured fields -----
function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const texts = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let sm;
  while ((sm = streamRe.exec(raw)) !== null) {
    const block = sm[1];
    // Collect (text) Tj and [(text)(text)] TJ occurrences
    const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    let tm;
    while ((tm = tjRe.exec(block)) !== null) {
      const t = tm[1]
        .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ")
        .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
      if (t.trim()) texts.push(t);
    }
  }
  // Fallback: also grab any readable ASCII runs of 4+ chars
  if (texts.length === 0) {
    const ascii = raw.match(/[ -~]{4,}/g) || [];
    texts.push(...ascii.filter(s => s.trim().split(/\s+/).length > 1));
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

async function parseJdText(text) {
  const fields = {};
  if (openaiClient) {
    try {
      const resp = await openaiClient.chat.completions.create({
        model: chatbotModel,
        messages: [
          {
            role: "system",
            content: "You extract structured job posting details from document text. Return ONLY valid JSON, no extra text."
          },
          {
            role: "user",
            content: `Extract the following fields from the document below and return as a JSON object.
Fields:
- title (job title)
- client (company or organisation name)
- department
- location
- employmentType (one of: Full-time, Part-time, Contract, Internship — pick the closest match)
- salaryRange (salary, package, or remuneration)
- closingDate (closing/deadline date in YYYY-MM-DD format, or empty string if not found)
- description (about the role, 2-5 sentences)
- responsibilities (key responsibilities, one bullet per line)
- requirements (qualifications and experience, one bullet per line)
- companyDescription (about the company or organisation)
- reasonForHiring
- contactPerson (hiring manager or contact name)

Use "" for any field you cannot find. Return ONLY JSON.

Document:
${text}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1400
      });
      const content = resp.choices?.[0]?.message?.content || "{}";
      Object.assign(fields, JSON.parse(content));
    } catch (err) {
      console.warn("[JD Parser] OpenAI failed, using regex fallback:", err?.message);
    }
  }
  // Regex fallback for any fields still missing
  const regexFill = (pattern, key) => {
    if (!fields[key]) {
      const m = text.match(pattern);
      if (m) fields[key] = m[1].replace(/\s+/g, " ").trim();
    }
  };
  regexFill(/(?:job\s+title|position|role|vacancy)\s*[:\-]\s*([^\n\r]{3,80})/i, "title");
  regexFill(/(?:company|organisation|organization|employer|client)\s*[:\-]\s*([^\n\r]{2,80})/i, "client");
  regexFill(/(?:location|based\s+in|work\s+location|site)\s*[:\-]\s*([^\n\r]{2,80})/i, "location");
  regexFill(/(?:department|team|division)\s*[:\-]\s*([^\n\r]{2,60})/i, "department");
  regexFill(/(?:salary|package|remuneration|pay)\s*[:\-]\s*([^\n\r]{2,80})/i, "salaryRange");
  regexFill(/(?:closing\s+date|deadline|applications\s+close)\s*[:\-]\s*([^\n\r]{2,40})/i, "closingDate");
  regexFill(/(?:contact\s+person|contact|hiring\s+manager)\s*[:\-]\s*([^\n\r]{2,80})/i, "contactPerson");
  return fields;
}

app.post("/api/admin/careers/parse-jd", requireDashboardAuth, async (req, res) => {
  try {
    const { fileName, mimeType, contentBase64 } = req.body || {};
    if (!contentBase64) {
      return respondWithError(res, 400, "No file content provided.");
    }
    const buffer = Buffer.from(contentBase64, "base64");
    const lowerName = String(fileName || "").toLowerCase();
    const mime = String(mimeType || "");
    let text = "";
    if (lowerName.endsWith(".docx") || mime.includes("wordprocessingml")) {
      try {
        const { default: mammoth } = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || "";
      } catch {
        return respondWithError(res, 422, "Could not read the DOCX file. Make sure it is a valid Word document.");
      }
    } else if (lowerName.endsWith(".pdf") || mime.includes("pdf")) {
      text = extractPdfText(buffer);
    } else {
      text = buffer.toString("utf8").replace(/\r\n/g, "\n");
    }
    if (!text.trim()) {
      return respondWithError(res, 422, "Could not extract readable text. Try saving the document as a .txt or .docx file and uploading again.");
    }
    const fields = await parseJdText(text.slice(0, 12000));
    res.json({ ok: true, fields });
  } catch (err) {
    console.error("[JD Parser]", err);
    respondWithError(res, 500, err?.message || "Failed to parse document.");
  }
});

app.post("/api/admin/careers/job-postings", requireDashboardAuth, (req, res) => {
  if (!cleanText(req.body.title)) {
    return respondWithError(res, 400, "Job title is required.", ["title"]);
  }
  const posting = careersDb.createJobPosting(req.body);
  res.status(201).json({ ok: true, posting });

  /* ── Pipedrive: create Organisation + Deal for this vacancy (fire-and-forget, toggle-gated) ── */
  if (getPdEnabled()) {
    setImmediate(async () => {
      await syncPipedriveJobPosting(posting);
    });
  }
});

app.patch("/api/admin/careers/job-postings/:id", requireDashboardAuth, (req, res) => {
  const posting = careersDb.updateJobPosting(Number(req.params.id), req.body);
  if (!posting) {
    return respondWithError(res, 404, "Job posting not found.");
  }
  res.json({ ok: true, posting });
});

app.post("/api/admin/careers/job-postings/:id/upload-image", requireDashboardAuth, (req, res) => {
  const { field, upload } = req.body || {};
  if (!field || !["company-logo", "cover-photo"].includes(field)) {
    return respondWithError(res, 400, "field must be 'company-logo' or 'cover-photo'.");
  }
  if (!upload) {
    return respondWithError(res, 400, "No upload provided.");
  }
  try {
    const result = careersDb.setJobPostingImage(Number(req.params.id), field, upload);
    res.json({ ok: true, ...result });
  } catch (err) {
    respondWithError(res, 400, err?.message || "Upload failed.");
  }
});

app.patch("/api/admin/careers/job-postings/:id/kpi-criteria", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.updatePositionKpiCriteria(Number(req.params.id), req.body || {});
    if (!result) {
      return respondWithError(res, 404, "Job posting not found.");
    }
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to save KPI criteria right now.");
  }
});

app.patch("/api/admin/careers/job-postings/:id/screening", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.updatePositionKpiCriteria(Number(req.params.id), req.body || {});
    if (!result) {
      return respondWithError(res, 404, "Job posting not found.");
    }
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to save KPI criteria right now.");
  }
});

app.delete("/api/admin/careers/job-postings/:id", requireDashboardAuth, (req, res) => {
  const posting = careersDb.deleteJobPosting(Number(req.params.id));
  if (!posting) {
    return respondWithError(res, 404, "Job posting not found.");
  }
  res.json({ ok: true, posting });
});

  app.post("/api/admin/careers/job-postings/:id/status", requireDashboardAuth, (req, res) => {
    const status = cleanText(req.body.status);
    if (!["draft", "ready", "published", "closed", "screening"].includes(status)) {
      return respondWithError(res, 400, "Invalid job posting status.", ["status"]);
    }
    const posting = careersDb.setJobPostingStatus(Number(req.params.id), status);
    if (!posting) {
      return respondWithError(res, 404, "Job posting not found.");
    }
    res.json({ ok: true, posting });
    if (status === "published" || status === "ready") {
      setImmediate(async () => {
        await syncPipedriveJobPosting(posting);
      });
    }
  });

  app.post("/api/admin/careers/job-postings/:id/push-to-screening", requireDashboardAuth, (req, res) => {
    try {
      const result = careersDb.pushPositionApplicantsToScreening(Number(req.params.id), {
        applicantOrder: Array.isArray(req.body?.applicantOrder) ? req.body.applicantOrder : []
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      respondWithError(res, 400, error?.message || "Unable to push this position to screening.");
    }
  });

  app.patch("/api/admin/careers/applications/:id/status", requireDashboardAuth, (req, res) => {
    const status = cleanText(req.body.status) || "new";
    const application = careersDb.updateApplicationStatus(Number(req.params.id), status);
  if (!application) {
    return respondWithError(res, 404, "Application not found.");
  }
  res.json({ ok: true, application });

  /* ── Pipedrive: move Deal to matching pipeline stage (fire-and-forget, toggle-gated) ── */
  if (getPdEnabled() && application?.pipedriveDealId) {
    setImmediate(() => pdUpdateDeal(application.pipedriveDealId, status).catch(() => {}));
  }
});

app.patch("/api/admin/careers/offers/status", requireDashboardAuth, (req, res) => {
  const applicationIds = Array.isArray(req.body?.applicationIds)
    ? req.body.applicationIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const status = cleanText(req.body?.status).toLowerCase();

  if (!applicationIds.length) {
    return respondWithError(res, 400, "Please select at least one offer.", ["applicationIds"]);
  }
  if (!["pending", "closed", "rejected", "deleted"].includes(status)) {
    return respondWithError(res, 400, "Invalid offer status.", ["status"]);
  }

  try {
    console.log(`[offers] update status=${status} ids=${applicationIds.join(",")}`);
    const applications = careersDb.updateOfferStatus(applicationIds, status, {
      reason: cleanText(req.body?.reason)
    });
    res.json({ ok: true, applications, status, count: applications.length });
  } catch (error) {
    console.error("[offers] update failed:", error?.message || error);
    respondWithError(res, 400, error?.message || "Unable to update offer status right now.");
  }
});

app.delete("/api/admin/careers/offers", requireDashboardAuth, (req, res) => {
  const applicationIds = Array.isArray(req.body?.applicationIds)
    ? req.body.applicationIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (!applicationIds.length) {
    return respondWithError(res, 400, "Please select at least one offer.", ["applicationIds"]);
  }

  try {
    console.log(`[offers] soft-delete ids=${applicationIds.join(",")}`);
    const applications = careersDb.softDeleteOffers(applicationIds, {
      reason: cleanText(req.body?.reason)
    });
    res.json({ ok: true, applications, status: "deleted", count: applications.length });
  } catch (error) {
    console.error("[offers] soft-delete failed:", error?.message || error);
    respondWithError(res, 400, error?.message || "Unable to delete the selected offer right now.");
  }
});

app.patch("/api/admin/careers/applications/:id/screening", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.saveApplicationScreening(Number(req.params.id), req.body || {});
    if (!result) {
      return respondWithError(res, 404, "Application not found.");
    }
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to save screening record right now.");
  }
});

app.patch("/api/admin/careers/applications/:id/shortlist-review", requireDashboardAuth, (req, res) => {
  try {
    const application = careersDb.saveApplicationShortlistReview(Number(req.params.id), req.body || {});
    if (!application) {
      return respondWithError(res, 404, "Application not found.");
    }
    res.json({ ok: true, application });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to save shortlist review right now.");
  }
});

app.get("/api/admin/screenings", requireDashboardAuth, (req, res) => {
  try {
    const positionId = req.query.positionId ? Number(req.query.positionId) : null;
    const result = careersDb.listPositionScreenings({ positionId });
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to load screening workspace right now.");
  }
});

app.post("/api/admin/screenings/sort", requireDashboardAuth, (req, res) => {
  try {
    const positionId = Number(req.body?.positionId);
    if (!Number.isFinite(positionId) || positionId <= 0) {
      return respondWithError(res, 400, "A valid positionId is required to sort applicants.");
    }
    const direction = String(req.body?.direction || "").toLowerCase() === "asc" ? "asc" : "desc";
    const result = careersDb.sortPositionScreeningApplicants(positionId, {
      direction,
      sortedBy: req.dashboardUser?.email || ""
    });
    res.json({ ok: true, positionId, direction, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to sort applicants right now.");
  }
});

app.get("/api/admin/screenings/tie-breakers", requireDashboardAuth, (req, res) => {
  try {
    const positionId = req.query.positionId ? Number(req.query.positionId) : null;
    const criteria = careersDb.listScreeningTieBreakerCriteria(positionId);
    res.json({ ok: true, criteria, count: criteria.length });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to load tie-breaker criteria right now.");
  }
});

app.post("/api/admin/screenings/tie-breakers", requireDashboardAuth, (req, res) => {
  try {
    const criteria = careersDb.createScreeningTieBreakerCriteria(req.body?.positionId, {
      ...req.body,
      createdBy: req.dashboardUser?.email || ""
    });
    res.status(201).json({ ok: true, criteria });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to create tie-breaker criteria right now.");
  }
});

app.get("/api/admin/screenings/tie-breakers/:id", requireDashboardAuth, (req, res) => {
  try {
    const criteria = careersDb.getScreeningTieBreakerCriteria(Number(req.params.id));
    if (!criteria) {
      return respondWithError(res, 404, "Tie-breaker criteria not found.");
    }
    res.json({ ok: true, criteria });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to load tie-breaker criteria right now.");
  }
});

app.patch("/api/admin/screenings/tie-breakers/:id", requireDashboardAuth, (req, res) => {
  try {
    const criteria = careersDb.updateScreeningTieBreakerCriteria(Number(req.params.id), req.body || {});
    res.json({ ok: true, criteria });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to update tie-breaker criteria right now.");
  }
});

app.post("/api/admin/screenings/:applicationId/tie-breaker", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.saveScreeningTieBreaker(Number(req.params.applicationId), {
      tieBreakerCriteriaId: req.body?.tieBreakerCriteriaId,
      tieBreakerPoints: req.body?.tieBreakerPoints,
      reviewed: req.body?.reviewed,
      reviewedBy: req.dashboardUser?.email || ""
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to save tie-breaker points right now.");
  }
});

app.post("/api/admin/screenings/sort-with-tie-breaker", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.sortPositionScreeningApplicantsWithTieBreaker(req.body?.positionId, {
      direction: req.body?.direction,
      tieBreakerCriteriaId: req.body?.tieBreakerCriteriaId,
      tieBreakers: req.body?.tieBreakers,
      sortedBy: req.dashboardUser?.email || ""
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to apply the tie-breaker right now.");
  }
});

app.post("/api/admin/screenings/push-to-shortlist", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.pushScreeningApplicantsToShortlist({
      positionId: req.body?.positionId,
      shortlistedApplicationIds: req.body?.shortlistedApplicationIds,
      nonShortlistedAction: req.body?.nonShortlistedAction,
      tieBreakers: req.body?.tieBreakers,
      decidedBy: req.dashboardUser?.email || ""
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[screenings] push to shortlist failed:", error?.message || error);
    respondWithError(res, 400, error?.message || "Unable to push applicants to shortlist.");
  }
});

app.get("/api/admin/positions/:positionId/screening-results", requireDashboardAuth, (req, res) => {
  const positionId = Number(req.params.positionId);
  const applicants = careersDb.listApplications().filter((application) => String(application.positionId) === String(positionId));
  res.json({ ok: true, applicants, count: applicants.length });
});

app.get("/api/admin/positions/:positionId/shortlisting-criteria", requireDashboardAuth, (req, res) => {
  const criteria = careersDb.listShortlistingCriteria(Number(req.params.positionId));
  res.json({ ok: true, criteria, count: criteria.length });
});

app.post("/api/admin/positions/:positionId/shortlisting-criteria", requireDashboardAuth, (req, res) => {
  try {
    const criteria = careersDb.createShortlistingCriteria(Number(req.params.positionId), req.body || {});
    res.status(201).json({ ok: true, criteria });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to create shortlisting criteria.");
  }
});

app.post("/api/admin/positions/:positionId/run-shortlisting", requireDashboardAuth, (req, res) => {
  try {
    const shortlistingCriteriaId = Number(req.body?.shortlistingCriteriaId || req.body?.criteriaId);
    const result = careersDb.runPositionShortlisting(Number(req.params.positionId), shortlistingCriteriaId);
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to run shortlisting.");
  }
});

app.post("/api/admin/positions/:positionId/push-to-shortlist", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.pushToShortlist({
      positionId: Number(req.params.positionId),
      shortlistingCriteriaId: Number(req.body?.shortlistingCriteriaId || req.body?.criteriaId),
      applicationIds: Array.isArray(req.body?.applicationIds) ? req.body.applicationIds : [],
      pushedBy: req.dashboardUser?.email || ""
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to push applicants to shortlist.");
  }
});

app.get("/api/admin/shortlisted", requireDashboardAuth, (req, res) => {
  const shortlisted = careersDb.listShortlistedApplicants({
    positionId: req.query.positionId ? Number(req.query.positionId) : null
  });
  res.json({ ok: true, shortlisted, count: shortlisted.length });
});

app.post("/api/admin/shortlisted/:applicationId/move-to-interview", requireDashboardAuth, (req, res) => {
  try {
    const application = careersDb.moveShortlistedToInterview(Number(req.params.applicationId));
    res.json({ ok: true, application });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to move shortlisted applicant to interview.");
  }
});

app.get("/api/admin/shortlisted/:applicantId/checklist", requireDashboardAuth, (req, res) => {
  const checklist = careersDb.getShortlistedChecklist(Number(req.params.applicantId));
  if (!checklist) {
    return respondWithError(res, 404, "Applicant not found.");
  }
  res.json({ ok: true, checklist });
});

app.post("/api/admin/shortlisted/:applicantId/checklist", requireDashboardAuth, (req, res) => {
  try {
    const checklist = careersDb.saveShortlistedChecklist(Number(req.params.applicantId), req.body || {});
    res.json({ ok: true, checklist, generatedReport: checklist.generatedReport || null });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to save shortlist checklist.");
  }
});

app.delete("/api/admin/careers/applications/:id", requireDashboardAuth, async (req, res) => {
  const id = Number(req.params.id);
  const includePipedrive = req.query.includePipedrive === "1" && getPdEnabled();

  // Capture Pipedrive IDs before deleting from DB
  const preDelete = includePipedrive ? careersDb.getApplication(id) : null;

  const application = careersDb.deleteApplication(id);
  if (!application) return respondWithError(res, 404, "Application not found.");

  res.json({ ok: true, application });

  // Fire-and-forget Pipedrive cleanup when requested
  if (includePipedrive && preDelete) {
    setImmediate(async () => {
      try {
        if (preDelete.pipedriveDealId)   await pdDeleteDeal(preDelete.pipedriveDealId);
        if (preDelete.pipedrivePersonId) await pdDeletePerson(preDelete.pipedrivePersonId);
        console.log(`[pipedrive] deleted person=${preDelete.pipedrivePersonId} deal=${preDelete.pipedriveDealId} for application=${id}`);
      } catch (err) {
        console.warn(`[pipedrive] delete cleanup error: ${err.message}`);
      }
    });
  }
});

/* ── Update applicant phone + optional Pipedrive sync ────────────────────── */
app.patch("/api/admin/careers/applications/:id/phone", requireDashboardAuth, async (req, res) => {
  const id = Number(req.params.id);
  const phone = cleanText(req.body?.phone || "");
  const updated = careersDb.updateApplicantPhone(id, phone);
  if (!updated) return respondWithError(res, 404, "Application not found.");
  const pdEnabled = getPdEnabled();
  res.json({ ok: true, application: updated, pdEnabled });
  if (pdEnabled && updated.pipedrivePersonId) {
    setImmediate(async () => {
      const synced = await pdUpdatePersonPhone(updated.pipedrivePersonId, phone);
      console.log(`[pipedrive] phone update person=${updated.pipedrivePersonId} ok=${synced}`);
    });
  }
});

app.get("/api/admin/dashboard/settings", requireDashboardAuth, (_req, res) => {
  res.json({ ok: true, settings: publicDashboardSettings(dashboardSettingsStore.getDashboardSettings()) });
});

app.patch("/api/admin/dashboard/settings", requireDashboardAuth, (req, res) => {
  const settings = dashboardSettingsStore.updateDashboardSettings(req.body || {});
  res.json({ ok: true, settings: publicDashboardSettings(settings) });
});

const handleMcpProxyRequest = async (req, res) => {
  try {
    const body = req.body || {};
    const targetPath = body.path || req.query.path || "/";
    const nextMethod = body.method || (req.method === "GET" ? "GET" : "POST");
    const payload = Object.prototype.hasOwnProperty.call(body, "payload") ? body.payload : null;
    const result = await forwardMcpRequest({
      targetPath,
      method: nextMethod,
      payload,
      query: body.query || null,
      headers: body.headers || {}
    });
    const reauth = parseMcpReauth(result);

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      proxied: true,
      status: result.status,
      statusText: result.statusText,
      url: result.url,
      code: reauth.reauthRequired ? "reauth_required" : undefined,
      reauthRequired: reauth.reauthRequired,
      provider: reauth.provider || undefined,
      authUrl: reauth.authUrl || undefined,
      data: result.data,
      raw: result.data ? undefined : safeResponseSnippet(result.raw)
    });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to forward the MCP request.");
  }
};

app.all("/api/mcp/proxy", requireDashboardAuth, handleMcpProxyRequest);

app.use((req, res, next) => {
  const { proxyPath } = readMcpSettings();
  if (proxyPath !== "/api/mcp/proxy" && req.path === proxyPath) {
    return requireDashboardAuth(req, res, () => handleMcpProxyRequest(req, res));
  }
  return next();
});

/* ── Pipedrive CRM ────────────────────────────────────────────────────────── */
const PD_BASE = "https://api.pipedrive.com/v1";
let _pdState = { lastSyncAt: null, lastSyncResult: null };
const getPdApiKey = () => process.env.PIPEDRIVE_API_KEY || "";

/** Middleware gate — returns true only when the Pipedrive CRM toggle is ON in Settings */
const getPdEnabled = () => {
  try {
    return Boolean(dashboardSettingsStore.getDashboardSettings().plugins?.customerCrm);
  } catch { return false; }
};

const pdUrl = (p, key) => {
  const k = key || getPdApiKey();
  return `${PD_BASE}${p}${p.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(k)}`;
};
const callPipedrive = async (p, { method = "GET", body, apiKey } = {}) => {
  const opts = { method, headers: { "Content-Type": "application/json", "Accept": "application/json" } };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  const res = await fetch(pdUrl(p, apiKey), opts);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
};
/** Delete a Person from Pipedrive by ID */
const pdDeletePerson = async (personId) => {
  const key = getPdApiKey();
  if (!key || !personId) return false;
  try {
    const { ok } = await callPipedrive(`/persons/${personId}`, { method: "DELETE", apiKey: key });
    return ok;
  } catch { return false; }
};

/** Delete a Deal from Pipedrive by ID */
const pdDeleteDeal = async (dealId) => {
  const key = getPdApiKey();
  if (!key || !dealId) return false;
  try {
    const { ok } = await callPipedrive(`/deals/${dealId}`, { method: "DELETE", apiKey: key });
    return ok;
  } catch { return false; }
};

/** Update a Person's phone in Pipedrive */
const pdUpdatePersonPhone = async (personId, phone) => {
  const key = getPdApiKey();
  if (!key || !personId) return false;
  try {
    const body = { phone: phone ? [{ value: phone, primary: true, label: "mobile" }] : [] };
    const { ok } = await callPipedrive(`/persons/${personId}`, { method: "PUT", body, apiKey: key });
    return ok;
  } catch { return false; }
};

const findPdPersonByEmail = async (email, apiKey) => {
  if (!email) return null;
  try {
    const { ok, data } = await callPipedrive(
      `/persons/search?term=${encodeURIComponent(email)}&field=email&exact_match=true&limit=1`,
      { apiKey }
    );
    const items = ok && data?.success ? (data?.data?.items || []) : [];
    return items.length ? items[0].item : null;
  } catch { return null; }
};

/* ── Pipedrive Recruitment Pipeline ──────────────────────────────────────── */
// Pipeline ID 3 = "HEYA Recruitment"  (created via API on 2026-05-23)
const PD_RECRUITMENT_PIPELINE_ID = 3;
const PD_STAGE_MAP = {
  new: 11, applied: 11,       // Stage 11 = Applied
  screening: 12, screened: 12, // Stage 12 = Screening
  shortlisted: 13,             // Stage 13 = Shortlisted
  interview: 14,               // Stage 14 = Interview
  offer: 15, hired: 15         // Stage 15 = Offer Sent  (deal → "won" when hired)
};

/** Push applicant as a Pipedrive Person, return person id or null */
const pdPushPerson = async (name, email, phone) => {
  const key = getPdApiKey();
  if (!key) return null;
  try {
    const body = { name: name || email || "Unknown" };
    if (email) body.email = [{ value: email, primary: true, label: "work" }];
    if (phone) body.phone = [{ value: phone, primary: true, label: "mobile" }];
    const { ok, data } = await callPipedrive("/persons", { method: "POST", body, apiKey: key });
    return ok && data?.success ? data.data.id : null;
  } catch { return null; }
};

/** Create a Pipedrive Deal in the recruitment pipeline, return deal id or null */
const pdCreateDeal = async (title, personId, orgId, stageId) => {
  const key = getPdApiKey();
  if (!key) return null;
  try {
    const body = {
      title: String(title || "Untitled"),
      pipeline_id: PD_RECRUITMENT_PIPELINE_ID,
      stage_id: stageId || PD_STAGE_MAP.applied,
      status: "open"
    };
    if (personId) body.person_id = Number(personId);
    if (orgId)    body.org_id    = Number(orgId);
    const { ok, data } = await callPipedrive("/deals", { method: "POST", body, apiKey: key });
    return ok && data?.success ? data.data.id : null;
  } catch { return null; }
};

const pdAddNote = async ({ content, dealId, orgId, personId }) => {
  const key = getPdApiKey();
  if (!key || !content) return null;
  try {
    const body = { content };
    if (dealId) body.deal_id = Number(dealId);
    if (orgId) body.org_id = Number(orgId);
    if (personId) body.person_id = Number(personId);
    const { ok, data } = await callPipedrive("/notes", { method: "POST", body, apiKey: key });
    return ok && data?.success ? data.data.id : null;
  } catch {
    return null;
  }
};

const pdEscape = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const pdPostingRequestNote = (posting, submission) => {
  const rows = [
    ["Position", posting.title],
    ["Company / organization", posting.company || posting.companyName || posting.client],
    ["Contact person", submission?.fullName || posting.contactPerson],
    ["Contact role", submission?.contactPersonRole],
    ["Email", submission?.email],
    ["Phone", submission?.phone],
    ["Company address", submission?.companyAddress],
    ["Industry", posting.industry || submission?.industry],
    ["Location", posting.location || submission?.location],
    ["Employment type", posting.employmentType || submission?.employmentType],
    ["Vacancies", posting.numHires || submission?.numberOfVacancies],
    ["Salary", posting.salaryRange || submission?.salaryDisplay],
    ["Application deadline", posting.closingDate || submission?.applicationDeadline],
    ["Career site URL", submission?.careerSiteUrl || posting.externalApplyUrl],
    ["Package interest", submission?.packageInterest],
    ["Job description", submission?.jobDescription || posting.description],
    ["Criteria", submission?.jobCriteria],
    ["Minimum qualifications", submission?.minimumQualifications],
    ["Required experience", submission?.requiredExperience],
    ["Required skills", submission?.requiredSkills],
    ["Application instructions", submission?.applicationInstructions],
    ["Supporting notes", submission?.supportingNotes],
    ["Additional message", submission?.additionalMessage || submission?.message],
    ["Source submission", submission?.code || posting.sourceSubmissionId]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());

  return `<strong>HEYA position publication request</strong><br>${rows
    .map(([label, value]) => `<strong>${pdEscape(label)}:</strong> ${pdEscape(value)}`)
    .join("<br>")}`;
};

const syncPipedriveJobPosting = async (posting) => {
  try {
    if (!posting) return { orgId: null, dealId: null };
    if (posting.pipedriveOrgId || posting.pipedriveDealId) {
      return { orgId: posting.pipedriveOrgId || null, dealId: posting.pipedriveDealId || null };
    }
    const existing = careersDb.getJobPostingPdIds(posting.id);
    if (existing?.orgId || existing?.dealId) {
      return existing;
    }
    const result = await pdPushOrgAndDealDetailed(posting);
    if (result.orgId || result.dealId) careersDb.storePdJobPostingIds(posting.id, result.orgId, result.dealId);
    return result;
  } catch (err) {
    console.warn(`[pipedrive] job posting org/deal error: ${err.message}`);
    return { orgId: null, dealId: null };
  }
};

/** Move a Pipedrive Deal to the stage matching a dashboard status; mark won/lost on hired/rejected */
const pdUpdateDeal = async (dealId, status) => {
  const key = getPdApiKey();
  if (!key || !dealId) return;
  try {
    const stageId = PD_STAGE_MAP[String(status).toLowerCase()];
    const body = {};
    if (status === "hired")    { body.status = "won"; }
    else if (status === "rejected") { body.status = "lost"; }
    else if (stageId)          { body.stage_id = stageId; }
    else return; // unknown status — do nothing
    await callPipedrive(`/deals/${dealId}`, { method: "PUT", body, apiKey: key });
  } catch { /* silent — never block the dashboard */ }
};

/** Create a Pipedrive Organisation + Deal for a new job posting, return { orgId, dealId } */
const pdPushOrgAndDeal = async (posting) => {
  const key = getPdApiKey();
  if (!key) return { orgId: null, dealId: null };
  try {
    let orgId = null;
    const company = String(posting.company || posting.companyName || posting.company_name || "").trim();
    if (company) {
      const { ok, data } = await callPipedrive("/organizations", {
        method: "POST",
        body: { name: company },
        apiKey: key
      });
      if (ok && data?.success) orgId = data.data.id;
    }
    const dealTitle = [posting.title, company].filter(Boolean).join(" — ");
    const dealId = await pdCreateDeal(dealTitle, null, orgId, PD_STAGE_MAP.applied);
    console.log(`[pipedrive] job posting id=${posting.id} → org=${orgId} deal=${dealId}`);
    return { orgId, dealId };
  } catch (err) {
    console.warn(`[pipedrive] pdPushOrgAndDeal error: ${err.message}`);
    return { orgId: null, dealId: null };
  }
};

const pdPushOrgAndDealDetailed = async (posting) => {
  const key = getPdApiKey();
  if (!key) return { orgId: null, dealId: null };
  try {
    let orgId = null;
    let personId = null;
    const company = String(posting.company || posting.companyName || posting.company_name || "").trim();
    const submission = posting.sourceSubmissionId
      ? careersDb.getEmployerSubmission(posting.sourceSubmissionId)
      : null;

    if (company) {
      const orgBody = { name: company };
      if (submission?.companyAddress) orgBody.address = submission.companyAddress;
      const { ok, data } = await callPipedrive("/organizations", {
        method: "POST",
        body: orgBody,
        apiKey: key
      });
      if (ok && data?.success) orgId = data.data.id;
    }

    if (submission?.fullName || submission?.email || submission?.phone) {
      personId = await pdPushPerson(submission.fullName, submission.email, submission.phone);
    }

    const dealTitle = [posting.title, company].filter(Boolean).join(" - ");
    const dealId = await pdCreateDeal(dealTitle, personId, orgId, PD_STAGE_MAP.applied);
    await pdAddNote({
      content: pdPostingRequestNote(posting, submission),
      dealId,
      orgId,
      personId
    });
    console.log(`[pipedrive] job posting id=${posting.id} -> org=${orgId} person=${personId} deal=${dealId}`);
    return { orgId, dealId };
  } catch (err) {
    console.warn(`[pipedrive] pdPushOrgAndDealDetailed error: ${err.message}`);
    return { orgId: null, dealId: null };
  }
};

app.get("/api/admin/pipedrive/settings", requireDashboardAuth, (_req, res) => {
  res.json({
    ok: true,
    enabled: getPdEnabled(),
    apiKeyConfigured: Boolean(getPdApiKey()),
    lastSyncAt: _pdState.lastSyncAt,
    lastSyncResult: _pdState.lastSyncResult,
    pipelineId: PD_RECRUITMENT_PIPELINE_ID,
    stageMap: PD_STAGE_MAP
  });
});

/** Return the Pipedrive deep-link URLs for a given applicant */
app.get("/api/admin/pipedrive/applicant/:id", requireDashboardAuth, (req, res) => {
  const application = careersDb.getApplication(Number(req.params.id));
  if (!application) return respondWithError(res, 404, "Application not found.");
  const personId = application.pipedrivePersonId;
  const dealId   = application.pipedriveDealId;
  res.json({
    ok: true,
    synced: Boolean(personId || dealId),
    personId,
    dealId,
    personUrl: personId ? `https://app.pipedrive.com/person/${personId}` : null,
    dealUrl:   dealId   ? `https://app.pipedrive.com/deal/${dealId}`     : null
  });
});

app.post("/api/admin/pipedrive/test", requireDashboardAuth, async (_req, res) => {
  const key = getPdApiKey();
  if (!key) return res.json({ ok: false, message: "No Pipedrive API key configured. Set PIPEDRIVE_API_KEY in Render environment variables." });
  try {
    const { ok, status, data } = await callPipedrive("/users/me", { apiKey: key });
    if (ok && data?.success) {
      const u = data.data;
      return res.json({ ok: true, message: `Connected as ${u.name || u.email || "unknown"}.`, user: { name: u.name, email: u.email, company: u.company_name } });
    }
    return res.json({ ok: false, message: data?.error || `Pipedrive returned HTTP ${status}.` });
  } catch (err) {
    return res.json({ ok: false, message: `Could not reach Pipedrive: ${err.message}` });
  }
});

app.post("/api/admin/pipedrive/sync", requireDashboardAuth, async (req, res) => {
  if (!req.body?.confirmed) return res.status(400).json({ ok: false, message: "Set { confirmed: true } to run the sync." });
  const key = getPdApiKey();
  if (!key) return res.status(503).json({ ok: false, message: "PIPEDRIVE_API_KEY is not set on this server." });
  const all = careersDb.listApplications();
  if (!all.length) return res.json({ ok: true, message: "No applicants found — nothing to sync.", synced: 0, skipped: 0, failed: 0, errors: [] });
  const results = { synced: 0, skipped: 0, failed: 0, errors: [] };
  for (const a of all) {
    const name = (a.name || a.fullName || "").trim();
    const email = (a.email || "").trim();
    const phone = (a.phone || "").trim();
    if (!name && !email) { results.skipped++; continue; }
    try {
      // Skip if person already exists in Pipedrive
      const existing = email ? await findPdPersonByEmail(email, key) : null;
      if (existing) {
        // Backfill IDs if we don't have them stored yet
        if (!a.pipedrivePersonId) careersDb.storePdApplicationIds(a.id, existing.id, a.pipedriveDealId);
        results.skipped++;
        continue;
      }
      const personId = await pdPushPerson(name, email, phone);
      if (!personId) { results.failed++; results.errors.push({ applicant: name || email, reason: "Person create returned no ID" }); continue; }
      // Create a deal for this applicant in the recruitment pipeline
      const pdJob = a.positionId ? careersDb.getJobPostingPdIds(a.positionId) : null;
      const dealTitle = `${name || email} — ${a.positionTitle || "Applicant"}`;
      const dealId = await pdCreateDeal(dealTitle, personId, pdJob?.orgId || null, PD_STAGE_MAP[a.status] || PD_STAGE_MAP.applied);
      careersDb.storePdApplicationIds(a.id, personId, dealId);
      results.synced++;
    } catch (err) { results.failed++; results.errors.push({ applicant: name || email, reason: err.message }); }
  }
  _pdState.lastSyncAt = new Date().toISOString();
  _pdState.lastSyncResult = results;
  res.json({ ok: true, message: `Sync complete — ${results.synced} created, ${results.skipped} skipped, ${results.failed} failed.`, ...results, syncedAt: _pdState.lastSyncAt });
});

/* ── Manual applicant creation (admin only, no file uploads required) ──── */
app.post("/api/admin/careers/applications/manual", requireDashboardAuth, async (req, res) => {
  const fullName = cleanText(req.body?.fullName || req.body?.name);
  const email    = normalizeEmail(req.body?.email || "");
  const positionId = Number(req.body?.positionId || 0);

  if (!fullName)    return respondWithError(res, 400, "Full name is required.", ["fullName"]);
  if (!isEmail(email)) return respondWithError(res, 400, "A valid email address is required.", ["email"]);
  if (!positionId)  return respondWithError(res, 400, "A position must be selected.", ["positionId"]);

  try {
    const application = careersDb.createManualApplication(positionId, {
      fullName,
      email,
      phone:           cleanText(req.body?.phone || ""),
      currentLocation: cleanText(req.body?.currentLocation || ""),
      yearsExperience: cleanText(req.body?.yearsExperience || ""),
      notes:           (req.body?.notes || "").slice(0, 2000),
      coverLetterText: cleanMultiline(req.body?.coverLetterText || ""),
      cvUpload:        req.body?.cvUpload || null,
      coverLetterUpload: req.body?.coverLetterUpload || null,
      idPhotoUpload:   req.body?.idPhotoUpload || null,
      status:          "new"
    });

    res.status(201).json({ ok: true, application });

    /* ── Pipedrive: auto-push (fire-and-forget, toggle-gated) ── */
    if (getPdEnabled()) {
      setImmediate(async () => {
        try {
          const pdKey = getPdApiKey();
          if (!pdKey) return;
          const existing = await findPdPersonByEmail(email, pdKey);
          const personId = existing?.id || await pdPushPerson(fullName, email, cleanText(req.body?.phone || ""));
          if (!personId) return;
          const pdJob = careersDb.getJobPostingPdIds(positionId);
          const dealTitle = `${fullName} — ${application.positionTitle}`;
          const dealId = await pdCreateDeal(dealTitle, personId, pdJob?.orgId || null, PD_STAGE_MAP.applied);
          careersDb.storePdApplicationIds(application.id, personId, dealId);
          console.log(`[pipedrive] manual applicant id=${application.id} → person=${personId} deal=${dealId}`);
        } catch (err) {
          console.warn(`[pipedrive] manual push error: ${err.message}`);
        }
      });
    }
  } catch (err) {
    respondWithError(res, 400, err.message || "Could not create applicant.");
  }
});

/* ── Bulk manual import from CSV (admin only) ─────────────────────────── */
app.post("/api/admin/careers/applications/bulk-manual", requireDashboardAuth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return respondWithError(res, 400, "No rows provided.");

  const results = { created: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of rows.slice(0, 200)) {
    const fullName   = cleanText(row.fullName || row.name || "");
    const email      = normalizeEmail(row.email || "");
    const positionId = Number(row.positionId || 0);
    if (!fullName || !isEmail(email) || !positionId) {
      results.skipped++;
      continue;
    }
    try {
      const application = careersDb.createManualApplication(positionId, {
        fullName, email,
        phone:           cleanText(row.phone || ""),
        currentLocation: cleanText(row.currentLocation || row.location || ""),
        yearsExperience: cleanText(row.yearsExperience || row.experience || ""),
        notes:           String(row.notes || "").slice(0, 2000)
      });
      results.created++;
      /* PD push for each (rate-limited via setImmediate) */
      setImmediate(async () => {
        try {
          const pdKey = getPdApiKey();
          if (!pdKey) return;
          const existing = await findPdPersonByEmail(email, pdKey);
          const personId = existing?.id || await pdPushPerson(fullName, email, cleanText(row.phone || ""));
          if (!personId) return;
          const pdJob = careersDb.getJobPostingPdIds(positionId);
          const dealTitle = `${fullName} — ${application.positionTitle}`;
          const dealId = await pdCreateDeal(dealTitle, personId, pdJob?.orgId || null, PD_STAGE_MAP.applied);
          careersDb.storePdApplicationIds(application.id, personId, dealId);
        } catch { /* silent */ }
      });
    } catch (err) {
      results.failed++;
      results.errors.push({ row: fullName || email, reason: err.message });
    }
  }

  res.json({
    ok: true,
    message: `Import complete — ${results.created} created, ${results.skipped} skipped, ${results.failed} failed.`,
    ...results
  });
});

app.post("/api/admin/mcp/oauth/start", requireDashboardAuth, async (req, res) => {
  try {
    const provider = String(req.body?.provider || "").trim().toLowerCase();
    const { result, authUrl } = await requestMcpOauthStart({
      provider,
      returnTo: req.body?.returnTo || "",
      state: req.body?.state || "",
      dashboardUserEmail: req.dashboardUser?.email || "",
      dashboardPath: req.originalUrl
    });

    if (!authUrl) {
      return respondWithError(res, 502, "Roxanne MCP did not return an OAuth URL for this provider.");
    }

    res.json({
      ok: true,
      provider,
      authUrl,
      status: result.status,
      statusText: result.statusText
    });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to start the MCP OAuth flow.");
  }
});

app.post("/api/admin/mcp/test", requireDashboardAuth, async (req, res) => {
  try {
    const settings = readMcpSettings();
    const probePayload = {
      type: "connection_test",
      source: "heya-dashboard",
      timestamp: new Date().toISOString(),
      permissions: settings.permissions,
      user: req.dashboardUser?.email || ""
    };

    let result = await forwardMcpRequest({
      targetPath: req.body?.path || "/",
      method: "POST",
      payload: probePayload
    });

    // Fallback to a simple GET probe when the root POST is not accepted.
    if (!result.ok && [404, 405, 415].includes(result.status)) {
      result = await forwardMcpRequest({
        targetPath: req.body?.path || "/",
        method: "GET",
        payload: null
      });
    }
    const reauth = parseMcpReauth(result, settings);

    res.status(200).json({
      ok: result.ok,
      connected: result.ok,
      status: result.status,
      statusText: result.statusText,
      endpoint: settings.endpoint,
      proxyPath: settings.proxyPath,
      serverLabel: settings.serverLabel,
      code: reauth.reauthRequired ? "reauth_required" : undefined,
      reauthRequired: reauth.reauthRequired,
      provider: reauth.provider || undefined,
      authUrl: reauth.authUrl || undefined,
      data: result.data,
      raw: result.data ? undefined : safeResponseSnippet(result.raw),
      message: result.ok
        ? `Connected to ${settings.serverLabel} successfully.`
        : reauth.reauthRequired
          ? `${reauth.provider ? reauth.provider[0].toUpperCase() + reauth.provider.slice(1) : "Provider"} authentication is required again.`
          : `The Roxanne MCP server responded with ${result.status} ${result.statusText}.`
    });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to test the MCP connection.");
  }
});

app.post("/api/admin/mcp/llm-test", requireDashboardAuth, async (req, res) => {
  try {
    const prompt = cleanMultiline(req.body?.message || req.body?.prompt || req.body?.input || "");
    if (!prompt) {
      return respondWithError(res, 400, "Enter a RoxanneAI instruction or JSON MCP payload.", ["message"]);
    }

    // Handle optional attached file
    let fileContext = "";
    const attachedFile = req.body?.file;
    let attachedFileType = "none"; // "text" | "image" | "pdf" | "binary"
    if (attachedFile && typeof attachedFile === "object" && attachedFile.contentBase64) {
      try {
        const mimeType = String(attachedFile.type || "").toLowerCase();
        const fileName = String(attachedFile.name || "attachment").replace(/[^\w.\-]/g, "_");
        const isText  = mimeType.startsWith("text/") || /\.(txt|csv|json|md|xml|html|htm|js|ts|jsx|tsx|css)$/i.test(fileName);
        const isImage = /^image\/(jpeg|jpg|png|gif|webp)/.test(mimeType) || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
        const isPdf   = mimeType === "application/pdf" || /\.pdf$/i.test(fileName);

        if (isText) {
          attachedFileType = "text";
          const decoded = Buffer.from(attachedFile.contentBase64, "base64").toString("utf-8").slice(0, 8000);
          fileContext = `\n\n[Attached file: ${fileName}]\n${decoded}`;
        } else if (isImage) {
          attachedFileType = "image";
          fileContext = `\n\n[Attached image: ${fileName}]`;
        } else if (isPdf) {
          attachedFileType = "pdf";
          fileContext = `\n\n[Attached PDF: ${fileName}]`;
        } else {
          attachedFileType = "binary";
          fileContext = `\n\n[Attached file: ${fileName} (${mimeType || "binary"})]`;
        }
      } catch {
        /* ignore file decode errors */
      }
    }

    const promptWithFile = fileContext ? prompt + fileContext : prompt;
    const isSocialPostIntent = socialPostPromptPattern.test(prompt);

    // ── Image generation intent detection ──────────────────────────────
    const IMAGE_GEN_RE = /\b(generate|create|draw|make|render|paint|design|produce)\s+(an?\s+)?(image|picture|photo|illustration|artwork|portrait|banner|graphic|visual|logo)\b|\b(dall-?e|text.to.image)\b/i;
    if (IMAGE_GEN_RE.test(prompt) && !isSocialPostIntent && openaiClient) {
      try {
        const imgResult = await openaiClient.images.generate({
          model: "dall-e-3",
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: "1024x1024",
          quality: "standard"
        });
        const imageUrl      = imgResult.data[0]?.url || null;
        const revisedPrompt = imgResult.data[0]?.revised_prompt || null;
        return res.status(200).json({
          ok: true,
          parserMode: "image-generation",
          llmConfigured: true,
          imageUrl,
          planSummary: { type: "image_generation" },
          message: revisedPrompt
            ? `Here's your image. DALL-E refined your prompt to:\n"${revisedPrompt}"`
            : "Image generated."
        });
      } catch (imgErr) {
        return res.status(200).json({
          ok: false,
          parserMode: "image-generation",
          llmConfigured: true,
          message: `Image generation failed: ${imgErr?.message || "unknown error"}`,
          error: imgErr?.message
        });
      }
    }

    const userId = dashboardMcpUserId(req.dashboardUser?.email);
    const hasConfirmedRequest = req.body?.confirmed === true && req.body?.request && typeof req.body.request === "object";

    // ── Direct-to-OpenAI shortcut ───────────────────────────────────────
    // When a readable file is attached (image / PDF / text), skip MCP routing
    // entirely. The intent is unambiguously "analyse this file" — there is no
    // MCP tool for that and routing through the classifier just produces phantom
    // tool names that MCP rejects with an error.
    const socialProviderForImage = attachedFileType === "image" && isSocialPostIntent
      ? getSocialProviderFromPrompt(prompt)
      : "";
    if (socialProviderForImage && !hasConfirmedRequest) {
      const postText = getSocialPostCaptionFromPrompt(prompt);
      let generatedImage = null;
      let parserMode = "social-image-post";

      if (socialDesignPromptPattern.test(prompt)) {
        try {
          const designPrompt = [
            "Edit the attached image into a polished square social media graphic for HEYA Talent Solutions.",
            "Use a professional recruitment and workforce-services style.",
            "The graphic should support this post caption:",
            postText,
            "Keep text minimal, clean, and suitable for LinkedIn and Facebook."
          ].join("\n");
          generatedImage = await editAttachedImageWithOpenAI(attachedFile, designPrompt);
          parserMode = "social-image-template";
        } catch (imgErr) {
          return res.status(200).json({
            ok: false,
            parserMode: "social-image-template",
            llmConfigured: Boolean(openaiClient),
            message: `Template image generation failed: ${imgErr?.message || "unknown error"}`,
            error: imgErr?.message
          });
        }
      }

      const imageAttachment = buildMcpImageAttachment(attachedFile);
      const generatedAttachment = generatedImage ? {
        filename: generatedImage.filename,
        name: generatedImage.filename,
        mimeType: generatedImage.mimeType,
        type: generatedImage.mimeType,
        contentBase64: generatedImage.contentBase64,
        altText: "HEYA Talent Solutions social post image"
      } : null;
      const postImageAttachment = generatedAttachment || imageAttachment;
      const postImageMedia = buildMcpImageMediaMeta(postImageAttachment);
      const plan = normalizeMcpPromptPlan({
        path: "/execute",
        method: "POST",
        payload: {
          tool: socialProviderForImage === "linkedin" ? "linkedin_post" : "facebook_post",
          provider: socialProviderForImage,
          text: postText,
          content: postText,
          userId,
          ...(generatedImage ? {
            imageUrl: generatedImage.imageUrl,
            image: postImageAttachment,
            media: postImageMedia ? [postImageMedia] : []
          } : {
            image: postImageAttachment,
            media: postImageMedia ? [postImageMedia] : []
          })
        }
      }, prompt, userId);
      const planSummary = describeMcpPlan(plan);

      return res.status(200).json({
        ok: true,
        parserMode,
        llmConfigured: Boolean(openaiClient),
        request: plan,
        planSummary,
        confirmationRequired: true,
        imageUrl: generatedImage?.imageUrl || undefined,
        message: [
          `I prepared a ${planSummary.provider} image post, but I will not publish it yet.`,
          generatedImage ? "RoxanneAI also edited the attached image into a designed template for the post." : "The attached image will be included with the post.",
          "Please review and confirm before Roxanne MCP sends it.",
          "",
          planSummary.postText
        ].join("\n")
      });
    }

    if (attachedFileType === "image" && imageEditPromptPattern.test(prompt) && !hasConfirmedRequest) {
      try {
        const editedImage = await editAttachedImageWithOpenAI(attachedFile, prompt);
        return res.status(200).json({
          ok: true,
          parserMode: "image-edit",
          llmConfigured: true,
          imageUrl: editedImage.imageUrl,
          message: editedImage.revisedPrompt
            ? `Image edited. OpenAI refined your prompt to:\n"${editedImage.revisedPrompt}"`
            : "Image edited.",
          planSummary: { type: "image_edit" }
        });
      } catch (editErr) {
        return res.status(200).json({
          ok: false,
          parserMode: "image-edit",
          llmConfigured: Boolean(openaiClient),
          message: `Image editing failed: ${editErr?.message || "unknown error"}`,
          error: editErr?.message
        });
      }
    }

    const isAnalysableFile = attachedFileType === "image" || attachedFileType === "pdf" || attachedFileType === "text";
    if (isAnalysableFile && openaiClient && !hasConfirmedRequest) {
      try {
        let userContent;
        const mimeType = String(attachedFile?.type || "application/octet-stream").toLowerCase();
        const fileName  = String(attachedFile?.name || "attachment").replace(/[^\w.\-]/g, "_");
        const contentParts = [{ type: "input_text", text: cleanMultiline(promptWithFile) }];

        if (attachedFileType === "image") {
          contentParts.push({ type: "input_image", image_url: `data:${mimeType};base64,${attachedFile.contentBase64}` });
        } else if (attachedFileType === "pdf") {
          contentParts.push({ type: "input_file", filename: fileName, file_data: `data:application/pdf;base64,${attachedFile.contentBase64}` });
        }
        // text files: content already appended inline via fileContext — no extra part needed
        userContent = (attachedFileType === "text") ? cleanMultiline(promptWithFile) : contentParts;

        const completion = await openaiClient.responses.create({
          model: chatbotModel,
          max_output_tokens: 1200,
          input: [
            {
              role: "system",
              content: "You are RoxanneAI, the AI assistant for the HEYA Limited recruiting dashboard. When a file or image is attached, analyse its content thoroughly and answer the user's question. Be concise and practical."
            },
            { role: "user", content: userContent }
          ]
        });
        return res.status(200).json({
          ok: true,
          parserMode: "direct-openai",
          llmConfigured: true,
          proxied: false,
          message: "RoxanneAI responded.",
          raw: completion.output_text || ""
        });
      } catch (directErr) {
        return res.status(200).json({
          ok: false,
          parserMode: "direct-openai",
          llmConfigured: true,
          message: directErr?.message || "RoxanneAI could not process the file.",
          error: directErr?.message
        });
      }
    }

    const parsed = hasConfirmedRequest
      ? {
        parserMode: "confirmed-request",
        plan: normalizeMcpPromptPlan(req.body.request, prompt.slice(0, 3000), userId)
      }
      : await buildMcpPromptPlan(promptWithFile.slice(0, 6000), userId);
    const { parserMode, plan } = parsed;
    const planSummary = describeMcpPlan(plan);
    const confirmed = req.body?.confirmed === true || req.body?.confirm === true;

    if (isMcpSocialPostPlan(plan) && !confirmed) {
      return res.status(200).json({
        ok: true,
        parserMode,
        llmConfigured: Boolean(openaiClient),
        request: plan,
        planSummary,
        confirmationRequired: true,
        message: [
          `I prepared a ${planSummary.provider} post, but I will not publish it yet.`,
          "Please review the draft and confirm before Roxanne MCP sends it.",
          "",
          planSummary.postText
        ].join("\n")
      });
    }

    if (plan.path === "/agent") {
      if (!openaiClient) {
        return res.status(200).json({
          ok: false,
          parserMode,
          llmConfigured: false,
          request: plan,
          planSummary,
          message: "OpenAI is not configured. Set OPENAI_API_KEY in .env to enable the RoxanneAI agent.",
          error: "OPENAI_API_KEY is not set."
        });
      }
      try {
        const agentMessage = cleanMultiline(plan.payload?.message || promptWithFile);

        // Build user content — include file as vision/file input when possible
        let userContent;
        if (attachedFile?.contentBase64 && (attachedFileType === "image" || attachedFileType === "pdf")) {
          const mimeType = String(attachedFile.type || "application/octet-stream").toLowerCase();
          const fileName = String(attachedFile.name || "attachment").replace(/[^\w.\-]/g, "_");
          const contentParts = [{ type: "input_text", text: agentMessage }];
          if (attachedFileType === "image") {
            contentParts.push({
              type: "input_image",
              image_url: `data:${mimeType};base64,${attachedFile.contentBase64}`
            });
          } else {
            // PDF — pass as file_data
            contentParts.push({
              type: "input_file",
              filename: fileName,
              file_data: `data:application/pdf;base64,${attachedFile.contentBase64}`
            });
          }
          userContent = contentParts;
        } else {
          userContent = agentMessage;
        }

        const agentCompletion = await openaiClient.responses.create({
          model: chatbotModel,
          max_output_tokens: 1200,
          input: [
            {
              role: "system",
              content: "You are RoxanneAI, the AI assistant for the HEYA Limited recruiting dashboard. Help the operator with recruitment tasks, social media content ideas, job posting advice, candidate pipeline questions, and workforce management. When a file or image is attached, analyse its content thoroughly as requested. Be concise and practical."
            },
            {
              role: "user",
              content: userContent
            }
          ]
        });
        return res.status(200).json({
          ok: true,
          parserMode,
          llmConfigured: true,
          request: plan,
          planSummary,
          proxied: false,
          message: "RoxanneAI responded.",
          raw: agentCompletion.output_text || ""
        });
      } catch (agentError) {
        return res.status(200).json({
          ok: false,
          parserMode,
          llmConfigured: true,
          request: plan,
          planSummary,
          message: agentError?.message || "RoxanneAI agent error.",
          error: agentError?.message || "OpenAI agent request failed."
        });
      }
    }

    const result = await forwardMcpRequest({
      targetPath: plan.path,
      method: plan.method,
      payload: plan.payload,
      headers: {
        "x-user-id": userId
      }
    });
    const reauth = parseMcpReauth(result);
    // A 500 on a social post without an explicit reauth signal almost always means
    // a missing or expired provider token — escalate to the reauth path so the
    // reconnect button appears rather than a misleading "not configured" message.
    const socialPost500 = isMcpSocialPostPlan(plan) && result.status === 500 && !reauth.reauthRequired;
    if (socialPost500) {
      reauth.reauthRequired = true;
      reauth.provider = reauth.provider || planSummary.provider;
    }
    // "Provider unavailable" only fires when reauth is NOT signalled AND the MCP
    // response explicitly mentions a missing integration (pattern match on text).
    const providerUnavailable = isMcpSocialPostPlan(plan)
      && !reauth.reauthRequired
      && isMcpProviderUnavailable(result, planSummary.provider);

    if (providerUnavailable) {
      return res.status(200).json({
        ok: true,
        parserMode,
        llmConfigured: Boolean(openaiClient),
        request: plan,
        planSummary,
        confirmationRequired: false,
        proxied: true,
        providerUnavailable: true,
        provider: planSummary.provider,
        status: result.status,
        statusText: result.statusText,
        data: result.data,
        raw: result.data ? undefined : safeResponseSnippet(result.raw, 800),
        message: buildProviderUnavailableMessage(planSummary)
      });
    }

    if (reauth.terminal) {
      return res.status(200).json({
        ok: false,
        parserMode,
        llmConfigured: Boolean(openaiClient),
        request: plan,
        planSummary,
        proxied: true,
        status: result.status,
        data: result.data,
        error: `MCP credential error (${reauth.code}): The API key or gateway credential was rejected. Update the MCP API key in Dashboard > Settings > Integrations.`,
        message: `MCP credential error (${reauth.code}): The API key or gateway credential was rejected. Update the MCP API key in Dashboard > Settings > Integrations.`
      });
    }

    if (reauth.reauthRequired && !reauth.authUrl) {
      try {
        const oauth = await requestMcpOauthStart({
          provider: reauth.provider || planSummary.provider,
          returnTo: cleanText(req.body?.returnTo || req.get("referer") || ""),
          state: `heya-${reauth.provider || planSummary.provider}-${Date.now()}`,
          dashboardUserEmail: req.dashboardUser?.email || "",
          dashboardPath: req.originalUrl
        });
        reauth.authUrl = oauth.authUrl;
      } catch {
        // MCP could not initiate OAuth; authUrl stays empty, button still appears.
      }
    }

    const responseMessage = result.ok && isMcpSocialPostPlan(plan)
      ? buildSocialPostSuccessMessage(planSummary)
      : result.ok
        ? "RoxanneAI parsed the request and Roxanne MCP accepted it."
      : result.status === 413
        ? "Roxanne MCP rejected the image because it is still too large. Try a smaller image, or increase the MCP server request body limit."
      : reauth.reauthRequired
        ? "Roxanne MCP needs provider authentication before this request can run."
        : `Roxanne MCP responded with ${result.status} ${result.statusText}.`;

    res.status(200).json({
      ok: result.ok,
      parserMode,
      llmConfigured: Boolean(openaiClient),
      request: plan,
      planSummary,
      confirmationRequired: false,
      proxied: true,
      status: result.status,
      statusText: result.statusText,
      endpoint: readMcpSettings().endpoint,
      code: reauth.reauthRequired ? "reauth_required" : undefined,
      reauthRequired: reauth.reauthRequired,
      provider: reauth.provider || (reauth.reauthRequired ? planSummary.provider : undefined) || undefined,
      authUrl: reauth.authUrl || undefined,
      data: result.data,
      raw: result.data ? undefined : safeResponseSnippet(result.raw, 800),
      error: result.ok ? undefined : responseMessage,
      message: responseMessage
    });
  } catch (error) {
    respondWithError(res, 400, error?.message || "Unable to run the RoxanneAI MCP test.");
  }
});

app.get("/api/settings/account", requireDashboardAuth, accountSettingsController.getAccountSettings);

app.patch("/api/settings/account", requireDashboardAuth, accountSettingsController.updateAccountSettings);

app.get("/api/admin/notifications", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const notifications = careersDb.listDashboardNotifications({
    status: cleanText(req.query.status) || "all",
    limit: Number(req.query.limit || 50)
  });
  logDashboardTiming("/api/admin/notifications", start, notifications.length);
  res.json({ ok: true, notifications, summary: careersDb.getDashboardNotificationSummary() });
});

app.get("/api/admin/notifications/unread-count", requireDashboardAuth, (_req, res) => {
  res.json({
    ok: true,
    unread: careersDb.getUnreadDashboardNotificationCount(),
    summary: careersDb.getDashboardNotificationSummary(),
    latestCreatedAt: careersDb.getLatestDashboardNotificationTimestamp()
  });
});

app.get("/api/admin/notifications/recent", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const notifications = careersDb.listRecentDashboardNotifications({
    limit: Number(req.query.limit || 10)
  });
  logDashboardTiming("/api/admin/notifications/recent", start, notifications.length);
  res.json({
    ok: true,
    notifications,
    summary: careersDb.getDashboardNotificationSummary(),
    latestCreatedAt: careersDb.getLatestDashboardNotificationTimestamp()
  });
});

app.post("/api/admin/notifications/:id/read", requireDashboardAuth, (req, res) => {
  const notification = careersDb.markDashboardNotificationRead(Number(req.params.id));
  if (!notification) {
    return respondWithError(res, 404, "Notification not found.");
  }
  res.json({ ok: true, notification, summary: careersDb.getDashboardNotificationSummary() });
});

app.delete("/api/admin/notifications/:id", requireDashboardAuth, (req, res) => {
  const notification = careersDb.deleteDashboardNotification(Number(req.params.id));
  if (!notification) {
    return respondWithError(res, 404, "Notification not found.");
  }
  res.json({ ok: true, notification, summary: careersDb.getDashboardNotificationSummary() });
});

app.get("/api/admin/messages", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const messages = careersDb.listInboxMessages({
    status: cleanText(req.query.status) || "all",
    kind: cleanText(req.query.kind) || "all",
    limit: Number(req.query.limit || 100)
  });
  logDashboardTiming("/api/admin/messages", start, messages.length);
  res.json({ ok: true, messages, summary: careersDb.getInboxSummary() });
});

app.get("/api/admin/messages/summary", requireDashboardAuth, (_req, res) => {
  res.json({ ok: true, summary: careersDb.getInboxSummary() });
});

app.get("/api/admin/messages/unread-count", requireDashboardAuth, (_req, res) => {
  res.json({
    ok: true,
    unread: careersDb.getUnreadInboxMessageCount(),
    summary: careersDb.getInboxSummary(),
    latestReceivedAt: careersDb.getLatestInboxMessageTimestamp()
  });
});

app.get("/api/admin/messages/recent", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const messages = careersDb.listRecentInboxMessages({
    limit: Number(req.query.limit || 8)
  });
  logDashboardTiming("/api/admin/messages/recent", start, messages.length);
  res.json({
    ok: true,
    messages,
    summary: careersDb.getInboxSummary(),
    latestReceivedAt: careersDb.getLatestInboxMessageTimestamp()
  });
});

app.get("/api/admin/messages/:id", requireDashboardAuth, (req, res) => {
  const message = careersDb.getAdminMessage(Number(req.params.id));
  if (!message) {
    return respondWithError(res, 404, "Message not found.");
  }
  res.json({ ok: true, message });
});

app.post("/api/admin/messages/:id/read", requireDashboardAuth, (req, res) => {
  const message = careersDb.setMessageStatus(Number(req.params.id), "read");
  if (!message) {
    return respondWithError(res, 404, "Message not found.");
  }
  res.json({ ok: true, message, summary: careersDb.getInboxSummary() });
});

app.post("/api/admin/messages/:id/unread", requireDashboardAuth, (req, res) => {
  const message = careersDb.setMessageStatus(Number(req.params.id), "unread");
  if (!message) {
    return respondWithError(res, 404, "Message not found.");
  }
  res.json({ ok: true, message, summary: careersDb.getInboxSummary() });
});

app.post("/api/admin/messages/:id/archive", requireDashboardAuth, (req, res) => {
  const message = careersDb.setMessageStatus(Number(req.params.id), "archived");
  if (!message) {
    return respondWithError(res, 404, "Message not found.");
  }
  res.json({ ok: true, message, summary: careersDb.getInboxSummary() });
});

app.post("/api/admin/messages/:id/add-to-talent-pool", requireDashboardAuth, (req, res) => {
  try {
    const result = careersDb.addMessageToTalentPool(Number(req.params.id), req.body || {});
    if (!result) {
      return respondWithError(res, 404, "Message not found.");
    }
    res.status(201).json({ ok: true, ...result, summary: careersDb.getInboxSummary() });
  } catch (err) {
    respondWithError(res, 400, err?.message || "Unable to add this person to the talent pool.");
  }
});

app.post("/api/admin/messages/:id/attach-to-job", requireDashboardAuth, (req, res) => {
  const jobPostingId = Number(req.body.positionId || req.body.jobPostingId);
  if (!jobPostingId) {
    return respondWithError(res, 400, "Please choose an open job advert.", ["positionId"]);
  }

  try {
    const result = careersDb.attachMessageToJob(Number(req.params.id), jobPostingId, req.body || {});
    if (!result) {
      return respondWithError(res, 404, "Message not found.");
    }
    res.status(201).json({ ok: true, ...result, summary: careersDb.getInboxSummary() });
  } catch (err) {
    respondWithError(res, 400, err?.message || "Unable to attach this application to the selected job advert.");
  }
});

app.get("/api/admin/careers/employer-submissions/refresh", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const since = cleanText(req.query.since);
  const items = since ? careersDb.listEmployerSubmissionsSince(since) : careersDb.listEmployerSubmissions();
  logDashboardTiming("/api/admin/careers/employer-submissions/refresh", start, items.length, since ? `(since=${since})` : "");
  res.json({
    ok: true,
    items,
    latestTimestamp: careersDb.getLatestEmployerSubmissionTimestamp(),
    count: items.length
  });
});

app.get("/api/admin/careers/applications/refresh", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const since = cleanText(req.query.since);
  const items = since ? careersDb.listApplicationsSince(since) : careersDb.listApplications();
  logDashboardTiming("/api/admin/careers/applications/refresh", start, items.length, since ? `(since=${since})` : "");
  res.json({
    ok: true,
    items,
    latestTimestamp: careersDb.getLatestApplicationTimestamp(),
    count: items.length
  });
});

app.get("/api/admin/careers/talent-pool/refresh", requireDashboardAuth, (req, res) => {
  const start = Date.now();
  const since = cleanText(req.query.since);
  const items = since ? careersDb.listTalentPoolEntriesSince(since) : careersDb.listTalentPoolEntries();
  logDashboardTiming("/api/admin/careers/talent-pool/refresh", start, items.length, since ? `(since=${since})` : "");
  res.json({
    ok: true,
    items,
    latestTimestamp: careersDb.getLatestTalentPoolTimestamp(),
    count: items.length
  });
});

app.delete("/api/admin/careers/employer-submissions/:id", requireDashboardAuth, (req, res) => {
  const submission = careersDb.deleteEmployerSubmission(Number(req.params.id));
  if (!submission) {
    return respondWithError(res, 404, "Employer submission not found.");
  }
  res.json({ ok: true, submission });
});

app.post("/api/admin/careers/employer-submissions/bulk-delete", requireDashboardAuth, (req, res) => {
  const deleted = careersDb.bulkDeleteEmployerSubmissions(req.body?.ids || []);
  res.json({ ok: true, deleted, count: deleted.length });
});

app.post("/api/admin/careers/employer-submissions/:id/create-draft", requireDashboardAuth, (req, res) => {
  const posting = careersDb.convertEmployerSubmissionToDraft(Number(req.params.id));
  if (!posting) {
    return respondWithError(res, 404, "Employer submission not found.");
  }
  res.status(201).json({ ok: true, posting });
  setImmediate(async () => {
    await syncPipedriveJobPosting(posting);
  });
});

app.post("/api/admin/careers/talent-pool", requireDashboardAuth, (req, res) => {
  const body = req.body || {};
  const fullName = cleanText(body.fullName);
  const email = normalizeEmail(body.email || "");
  if (!fullName) return respondWithError(res, 400, "Full name is required.", ["fullName"]);
  if (!email || !isEmail(email)) return respondWithError(res, 400, "A valid email address is required.", ["email"]);
  try {
    const talent = careersDb.createTalentPoolSubmission({
      fullName,
      email,
      phone: cleanText(body.phone),
      currentLocation: cleanText(body.currentLocation),
      yearsExperience: cleanText(body.yearsExperience),
      desiredRoles: cleanText(body.desiredRoles),
      industries: cleanText(body.industries),
      preferredWorkLocation: cleanText(body.preferredWorkLocation),
      highestQualification: cleanText(body.highestQualification),
      keySkills: cleanText(body.keySkills),
      availability: cleanText(body.availability),
      message: cleanMultiline(body.summary || body.message),
      coverLetterText: cleanMultiline(body.coverLetterText),
      additionalNotes: cleanMultiline(body.additionalNotes),
      cvUpload: body.cvUpload || null,
      coverLetterUpload: body.coverLetterUpload || null,
      sourcePath: cleanText(body.sourcePath) || "/dashboard/talent-pool/manual-add",
      ipAddress: requestMeta(req).ipAddress,
      userAgent: requestMeta(req).userAgent,
    });
    res.status(201).json({ ok: true, talent });
  } catch (err) {
    console.error("[admin talent-pool create]", err.message);
    respondWithError(res, 400, err.message || "Could not save talent pool entry.");
  }
});

app.patch("/api/admin/careers/talent-pool/:id", requireDashboardAuth, (req, res) => {
  const talent = careersDb.updateTalentPoolProfile(Number(req.params.id), req.body || {});
  if (!talent) {
    return respondWithError(res, 404, "Talent pool profile not found.");
  }
  res.json({ ok: true, talent });
});

app.delete("/api/admin/careers/talent-pool/:id", requireDashboardAuth, (req, res) => {
  const talent = careersDb.deleteTalentPoolEntry(Number(req.params.id));
  if (!talent) {
    return respondWithError(res, 404, "Talent pool profile not found.");
  }
  res.json({ ok: true, talent });
});

app.post("/api/admin/careers/talent-pool/bulk-delete", requireDashboardAuth, (req, res) => {
  const deleted = careersDb.bulkDeleteTalentPoolEntries(req.body?.ids || []);
  res.json({ ok: true, deleted, count: deleted.length });
});

app.get("/api/admin/careers/files/:id/download", requireDashboardAuth, (req, res) => {
  const file = careersDb.getCareerFileById(Number(req.params.id));
  if (!file || !fs.existsSync(file.absolutePath)) {
    return respondWithError(res, 404, "File not found.");
  }

  res.download(file.absolutePath, file.original_name);
});

app.get("/api/admin/careers/positions/:positionId/download-zip", requireDashboardAuth, (req, res) => {
  const positionId = Number(req.params.positionId);
  const position = careersDb.getJobPosting(positionId);
  if (!position) return respondWithError(res, 404, "Position not found.");

  const applications = careersDb.listApplicationsForPosition(positionId);
  const safeTitle = String(position.title || "position").replace(/[^a-z0-9_\-\s]/gi, "").trim().replace(/\s+/g, "-") || "position";
  const zipName = `${safeTitle}-applications.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("error", (err) => {
    console.error("[download-zip] archiver error:", err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  for (const applicant of applications) {
    const safeName = String(applicant.name || applicant.fullName || `applicant-${applicant.id}`).replace(/[^a-z0-9_\-\s]/gi, "").trim().replace(/\s+/g, "-") || `applicant-${applicant.id}`;
    const allFiles = careersDb.getAllFilesForApplication(Number(applicant.id));
    for (const fileRow of allFiles) {
      const absolutePath = path.join(
        process.env.CAREERS_UPLOAD_DIR
          ? path.resolve(process.env.CAREERS_UPLOAD_DIR)
          : path.join(__dirname, "data", "uploads", "careers"),
        fileRow.relative_path
      );
      if (!fs.existsSync(absolutePath)) continue;
      const ext = path.extname(fileRow.original_name || fileRow.stored_name || "") || "";
      const fieldLabel = String(fileRow.field_name || "file").replace(/[^a-z0-9_\-]/gi, "-");
      archive.file(absolutePath, { name: `${safeName}/${fieldLabel}${ext}` });
    }
  }

  archive.finalize();
});

/* ── Per-Applicant ZIP Download ──────────────────────────────────────── */
app.get("/api/admin/careers/applications/:id/download-zip", requireDashboardAuth, (req, res) => {
  const appId = Number(req.params.id);
  if (!appId) return respondWithError(res, 400, "Invalid application ID.");

  const applicant = careersDb.getApplication(appId);
  if (!applicant) return respondWithError(res, 404, "Application not found.");

  const safeName = String(applicant.name || applicant.fullName || `applicant-${appId}`)
    .replace(/[^a-z0-9_\-\s]/gi, "").trim().replace(/\s+/g, "-") || `applicant-${appId}`;
  const zipName = `${safeName}-cv-data.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("error", (err) => {
    console.error("[application-download-zip] archiver error:", err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  const uploadsRoot = process.env.CAREERS_UPLOAD_DIR
    ? path.resolve(process.env.CAREERS_UPLOAD_DIR)
    : path.join(__dirname, "data", "uploads", "careers");

  const allFiles = careersDb.getAllFilesForApplication(appId);
  for (const fileRow of allFiles) {
    const absolutePath = path.join(uploadsRoot, fileRow.relative_path);
    if (!fs.existsSync(absolutePath)) continue;
    const ext = path.extname(fileRow.original_name || fileRow.stored_name || "") || "";
    const fieldLabel = String(fileRow.field_name || "file").replace(/[^a-z0-9_\-]/gi, "-");
    archive.file(absolutePath, { name: `${safeName}/${fieldLabel}${ext}` });
  }

  const posTitle = applicant.positionTitle || applicant.jobTitle || "";
  const manifest = [
    "HEYA Talent Solutions — Applicant Export",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Name:     ${applicant.name || ""}`,
    `Email:    ${applicant.email || ""}`,
    `Position: ${posTitle}`,
    `Status:   ${applicant.status || ""}`,
    `Applied:  ${applicant.appliedAt || applicant.createdAt || ""}`,
    `Score:    ${applicant.score != null ? applicant.score : "N/A"}`,
    "",
    `Files included: ${allFiles.length}`,
  ].join("\n");
  archive.append(manifest, { name: `${safeName}/manifest.txt` });

  archive.finalize();
});

/* ── Reports Pre-built Analysis ─────────────────────────────────────── */
app.get("/api/admin/reports/analysis/:type", requireDashboardAuth, (req, res) => {
  const type = String(req.params.type || "").toLowerCase();

  try {
    const apps      = careersDb.listApplications() || [];
    const dashData  = careersDb.getDashboardData({ includeNotifications: false, talentPoolLimit: 0, employerSubmissionsLimit: 0 });
    const positions = dashData.positions || [];

    /* helper: build a position map */
    const posMap = Object.fromEntries(positions.map((p) => [String(p.id), p]));

    /* ── 1. Pipeline Funnel ────────────────────────────────────────── */
    if (type === "funnel") {
      const stageOrder = ["applied","screening","screened","shortlist_eligible","shortlisted","interview","final_review","offer","hired","not_shortlisted","rejected","closed"];
      const counts = {};
      apps.forEach((a) => { const s = a.status || "applied"; counts[s] = (counts[s] || 0) + 1; });
      const total = apps.length;
      const rows = stageOrder
        .filter((s) => counts[s] > 0)
        .map((s) => ({
          stage: s,
          label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          count: counts[s],
          pct: total > 0 ? Math.round((counts[s] / total) * 100) : 0
        }));
      const activeRows  = rows.filter((r) => !["not_shortlisted","rejected","closed"].includes(r.stage));
      const exitedRows  = rows.filter((r) => ["not_shortlisted","rejected","closed"].includes(r.stage));
      return res.json({ ok: true, type, title: "Pipeline Funnel",
        summary: `${total} total applicant${total !== 1 ? "s" : ""} across ${rows.length} stage${rows.length !== 1 ? "s" : ""}`,
        activeRows, exitedRows, total });
    }

    /* ── 2. Top Positions by Applicants ───────────────────────────── */
    if (type === "positions") {
      const countByPos = {};
      apps.forEach((a) => {
        const key = String(a.positionId || "unknown");
        if (!countByPos[key]) countByPos[key] = { total: 0, hired: 0, offered: 0 };
        countByPos[key].total++;
        if (a.status === "hired") countByPos[key].hired++;
        if (a.offerStatus === "pending" || a.offerStatus === "closed") countByPos[key].offered++;
      });
      const rows = Object.entries(countByPos).map(([posId, stats]) => {
        const pos = posMap[posId] || {};
        return { positionId: posId, title: pos.title || "Unknown position", status: pos.status || "", ...stats };
      }).sort((a, b) => b.total - a.total).slice(0, 10);
      return res.json({ ok: true, type, title: "Top Positions by Applicants",
        summary: `${positions.length} positions · ${apps.length} total applications`,
        rows, positionCount: positions.length, applicantCount: apps.length });
    }

    /* ── 3. Score Breakdown ────────────────────────────────────────── */
    if (type === "scores") {
      const scored = apps.filter((a) => a.score != null && !isNaN(Number(a.score)));
      if (scored.length === 0) {
        return res.json({ ok: true, type, title: "Score Breakdown",
          summary: "No score data recorded yet.", rows: [], topScorers: [], hasData: false });
      }
      const nums = scored.map((a) => Number(a.score));
      const avg  = nums.reduce((s, n) => s + n, 0) / nums.length;
      const max  = Math.max(...nums);
      const min  = Math.min(...nums);
      const buckets = [
        { label: "90 – 100", min: 90, max: 100, count: 0 },
        { label: "75 – 89",  min: 75, max: 89,  count: 0 },
        { label: "60 – 74",  min: 60, max: 74,  count: 0 },
        { label: "45 – 59",  min: 45, max: 59,  count: 0 },
        { label: "0 – 44",   min: 0,  max: 44,  count: 0 },
      ];
      nums.forEach((n) => { const b = buckets.find((bk) => n >= bk.min && n <= bk.max); if (b) b.count++; });
      const topScorers = [...scored].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 5).map((a) => ({
        name: a.name, score: Number(a.score), position: (posMap[String(a.positionId)] || {}).title || "—", status: a.status
      }));
      return res.json({ ok: true, type, title: "Score Breakdown",
        summary: `${scored.length} scored applicants · avg ${avg.toFixed(1)} · range ${min}–${max}`,
        avg: parseFloat(avg.toFixed(1)), max, min, total: scored.length,
        buckets, topScorers, hasData: true });
    }

    /* ── 4. Offer Conversion ──────────────────────────────────────── */
    if (type === "offers") {
      const total       = apps.length;
      const withOffer   = apps.filter((a) => a.offerStatus && a.offerStatus !== "deleted").length;
      const hired       = apps.filter((a) => a.status === "hired").length;
      const pendingOff  = apps.filter((a) => a.offerStatus === "pending").length;
      const closedOff   = apps.filter((a) => a.offerStatus === "closed").length;
      const rejectedOff = apps.filter((a) => a.offerStatus === "rejected").length;
      const offerRate   = total > 0 ? parseFloat(((withOffer / total) * 100).toFixed(1)) : 0;
      const hireRate    = withOffer > 0 ? parseFloat(((hired / withOffer) * 100).toFixed(1)) : 0;
      return res.json({ ok: true, type, title: "Offer Conversion",
        summary: `${offerRate}% of applicants reached the offer stage · ${hireRate}% offer-to-hire`,
        total, withOffer, hired, pendingOff, closedOff, rejectedOff, offerRate, hireRate });
    }

    /* ── 5. Document Completeness ──────────────────────────────────── */
    if (type === "documents") {
      const total     = apps.length;
      const hasCV     = apps.filter((a) => a.cvName || a.cvComplete).length;
      const hasCover  = apps.filter((a) => a.coverLetterName).length;
      const hasBoth   = apps.filter((a) => (a.cvName || a.cvComplete) && a.coverLetterName).length;
      const complete  = apps.filter((a) => a.cvComplete === true).length;
      const cvPct     = total > 0 ? Math.round((hasCV / total) * 100) : 0;
      const coverPct  = total > 0 ? Math.round((hasCover / total) * 100) : 0;
      const bothPct   = total > 0 ? Math.round((hasBoth / total) * 100) : 0;
      const rows = [
        { label: "CV / Résumé submitted",          count: hasCV,    pct: cvPct },
        { label: "Cover letter submitted",          count: hasCover, pct: coverPct },
        { label: "Both documents present",          count: hasBoth,  pct: bothPct },
        { label: "Fully verified complete",         count: complete, pct: total > 0 ? Math.round((complete / total) * 100) : 0 },
      ];
      return res.json({ ok: true, type, title: "Document Completeness",
        summary: `${cvPct}% have a CV · ${coverPct}% have a cover letter`,
        total, rows });
    }

    /* ── 6. Recent Activity ────────────────────────────────────────── */
    if (type === "activity") {
      const now   = new Date();
      const day   = 24 * 60 * 60 * 1000;
      const bands = [
        { label: "Last 7 days",  days: 7,  count: 0 },
        { label: "8 – 14 days",  days: 14, count: 0 },
        { label: "15 – 30 days", days: 30, count: 0 },
        { label: "31 – 60 days", days: 60, count: 0 },
        { label: "60+ days",     days: Infinity, count: 0 },
      ];
      let undated = 0;
      apps.forEach((a) => {
        if (!a.appliedAt) { undated++; return; }
        const d = new Date(a.appliedAt);
        if (isNaN(d)) { undated++; return; }
        const age = (now - d) / day;
        const band = bands.find((b, i) => {
          const prev = i === 0 ? 0 : bands[i - 1].days;
          return age >= prev && age < b.days;
        });
        if (band) band.count++;
      });
      const last30 = bands.slice(0, 3).reduce((s, b) => s + b.count, 0);
      return res.json({ ok: true, type, title: "Recent Activity",
        summary: `${last30} application${last30 !== 1 ? "s" : ""} in the last 30 days`,
        bands, undated, total: apps.length });
    }

    return res.status(400).json({ ok: false, error: `Unknown analysis type: ${type}` });
  } catch (err) {
    console.error("[reports/analysis]", err);
    return respondWithError(res, 500, "Analysis failed: " + (err.message || "unknown error"));
  }
});

/* ── Reports CSV Export ─────────────────────────────────────────────── */
app.get("/api/admin/reports/csv", requireDashboardAuth, (req, res) => {
  const type = String(req.query.type || "applicants").toLowerCase();

  function csvRow(cells) {
    return cells.map((v) => {
      const s = String(v == null ? "" : v).replace(/\r?\n/g, " ");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",");
  }

  try {
    if (type === "positions") {
      const data = careersDb.getDashboardData({ includeNotifications: false, applicationsLimit: 0, talentPoolLimit: 0, employerSubmissionsLimit: 0 });
      const rows = data.positions || [];
      const header = csvRow(["ID", "Title", "Department", "Location", "Status", "Client", "Closing Date", "Created At"]);
      const body = rows.map((p) => csvRow([p.id, p.title, p.department, p.location, p.status, p.client, p.closingDate, p.createdAt]));
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="heya-positions-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.send([header, ...body].join("\n"));
    }

    if (type === "offers") {
      const offers = careersDb.listOffers({});
      const header = csvRow(["Applicant ID", "Name", "Email", "Position", "Offer Status", "Updated At"]);
      const body = (offers || []).map((o) => csvRow([o.id, o.name, o.email, o.positionTitle || "", o.offerStatus, o.offerStatusUpdatedAt || o.updatedAt || ""]));
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="heya-offers-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.send([header, ...body].join("\n"));
    }

    // Default: applicants
    const apps = careersDb.listApplications ? careersDb.listApplications() : [];
    const header = csvRow(["ID", "Name", "Email", "Phone", "Position ID", "Status", "Score", "Applied At", "Updated At", "Offer Status", "CV File", "Cover Letter"]);
    const body = apps.map((a) => csvRow([
      a.id, a.name, a.email, a.phone, a.positionId, a.status,
      a.score != null ? a.score : "", a.appliedAt, a.updatedAt,
      a.offerStatus || "", a.cvName || "", a.coverLetterName || ""
    ]));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="heya-applicants-${new Date().toISOString().slice(0,10)}.csv"`);
    return res.send([header, ...body].join("\n"));
  } catch (err) {
    console.error("[reports/csv]", err);
    return respondWithError(res, 500, "Failed to generate CSV report.");
  }
});

app.post("/api/admin/careers/positions/:positionId/ai-filter", requireDashboardAuth, async (req, res) => {
  const positionId = Number(req.params.positionId);
  const position = careersDb.getJobPosting(positionId);
  if (!position) return respondWithError(res, 404, "Position not found.");

  if (!openaiClient) return respondWithError(res, 503, "OpenAI is not configured. Please set OPENAI_API_KEY.");

  const applications = careersDb.listApplicationsForPosition(positionId);
  const uploadsRoot = process.env.CAREERS_UPLOAD_DIR
    ? path.resolve(process.env.CAREERS_UPLOAD_DIR)
    : path.join(__dirname, "data", "uploads", "careers");

  const systemPrompt = `You are an AI document completeness checker for HEYA Talent Solutions, a Papua New Guinea recruitment firm. Your job is ONLY to check whether required documents are present and appear complete. You do NOT judge applicant suitability or make hiring decisions.

Analyze the applicant's submitted documents and return a JSON object with this exact structure:
{
  "applicantId": "string",
  "positionId": "string",
  "criteria": {
    "cv_resume_present": 0,
    "cv_resume_readable": 0,
    "profile_picture_present": 0,
    "cover_letter_or_interest_letter_present": 0,
    "application_form_complete": 0,
    "required_id_documents_present": 0,
    "tabonetta_or_community_document_present": 0,
    "additional_supporting_documents_present": 0
  },
  "totalScore": 0,
  "maxScore": 8,
  "summary": "one sentence describing document completeness"
}

Rules:
- Return 1 if the item is present and appears usable, 0 if missing or unusable
- totalScore = sum of all criteria values
- Do NOT comment on qualifications, experience, or suitability
- Respond with valid JSON only, no markdown, no explanation`;

  const results = [];

  for (const applicant of applications) {
    try {
      const allFiles = careersDb.getAllFilesForApplication(Number(applicant.id));
      const filesSummary = allFiles.map(f => {
        const absolutePath = path.join(uploadsRoot, f.relative_path);
        const exists = fs.existsSync(absolutePath);
        const sizeBytes = exists ? (() => { try { return fs.statSync(absolutePath).size; } catch { return 0; } })() : 0;
        return `- field: ${f.field_name || "unknown"}, name: ${f.original_name || f.stored_name || "unnamed"}, type: ${f.mime_type || "unknown"}, size: ${sizeBytes} bytes, onDisk: ${exists}`;
      }).join("\n");

      const hasName = Boolean(applicant.name || applicant.fullName);
      const hasEmail = Boolean(applicant.email);
      const hasPhone = Boolean(applicant.phone);

      const userPrompt = `Applicant: ${applicant.name || applicant.fullName || "Unknown"}
Email: ${applicant.email || "not provided"}
Phone: ${applicant.phone || "not provided"}
Position: ${position.title}

Uploaded files:
${filesSummary || "No files uploaded"}

Cover letter text: ${applicant.coverLetterText ? applicant.coverLetterText.slice(0, 500) : "not provided"}
Application form data: name=${hasName ? "yes" : "no"}, email=${hasEmail ? "yes" : "no"}, phone=${hasPhone ? "yes" : "no"}, location=${applicant.currentLocation || "not provided"}, experience=${applicant.yearsExperience || "not provided"}

Based on the above, determine document completeness. Check for any file that could serve as a community endorsement, tabonetta, or local identity verification document (even if named differently).`;

      const completion = await openaiClient.responses.create({
        model: chatbotModel,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_output_tokens: 400
      });

      const rawText = completion.output_text || (completion.output && completion.output[0]?.content?.[0]?.text) || "";
      let parsed = null;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        parsed = null;
      }

      const criteria = parsed?.criteria || {
        cv_resume_present: 0,
        cv_resume_readable: 0,
        profile_picture_present: 0,
        cover_letter_or_interest_letter_present: 0,
        application_form_complete: 0,
        required_id_documents_present: 0,
        tabonetta_or_community_document_present: 0,
        additional_supporting_documents_present: 0
      };
      const totalScore = parsed?.totalScore ?? Object.values(criteria).reduce((s, v) => s + Number(v || 0), 0);
      const summary = parsed?.summary || "Document check incomplete.";

      results.push({
        applicantId: String(applicant.id),
        positionId: String(positionId),
        criteria,
        totalScore,
        maxScore: 8,
        summary
      });
    } catch (err) {
      console.error(`[ai-filter] Error processing applicant ${applicant.id}:`, err?.message || err);
      results.push({
        applicantId: String(applicant.id),
        positionId: String(positionId),
        criteria: {
          cv_resume_present: 0,
          cv_resume_readable: 0,
          profile_picture_present: 0,
          cover_letter_or_interest_letter_present: 0,
          application_form_complete: 0,
          required_id_documents_present: 0,
          tabonetta_or_community_document_present: 0,
          additional_supporting_documents_present: 0
        },
        totalScore: 0,
        maxScore: 8,
        summary: "AI check failed for this applicant."
      });
    }
  }

  results.sort((a, b) => b.totalScore - a.totalScore);

  const filtrationData = {
    status: "done",
    mode: "ai",
    runAt: new Date().toISOString(),
    positionId: String(positionId),
    results,
    order: results.map(r => r.applicantId),
    scorecards: results.map(r => ({
      applicantId: r.applicantId,
      score: r.totalScore,
      maxScore: 8,
      criteria: r.criteria,
      summary: r.summary
    }))
  };

  const updatedPosition = careersDb.savePositionFiltration(positionId, filtrationData);

  res.json({
    ok: true,
    filtration: filtrationData,
    position: updatedPosition
  });
});

app.get(["/submissions", "/admin/submissions"], requireSubmissionsAccess, (_req, res) => {
  render(res, "submissions", {
    active: "",
    bodyId: "page-submissions",
    pageTitle: "Submissions | HEYA Talent Solutions",
    pageDescription: "Private HEYA Talent Solutions contact and vacancy submissions dashboard.",
    ...getSubmissionDashboardData()
  });
});

app.get("/api/submissions", requireSubmissionsAccess, (_req, res) => {
  res.json({ ok: true, ...getSubmissionDashboardData() });
});

app.get("/api/email/status", requireSubmissionsAccess, (_req, res) => {
  res.json({ ok: true, ...getEmailConfigStatus() });
});

app.get(/^\/dashboard$/, requireDashboardAuth, (_req, res) => {
  res.redirect(302, "/dashboard/");
});

app.get(/^\/admin-dashboard$/, requireDashboardAuth, (_req, res) => {
  res.redirect(302, "/admin-dashboard/");
});

app.get(/^\/dashboard\/$/, requireDashboardAuth, (_req, res) => {
  res.sendFile(path.join(dashboardFrontendPath, "index.html"));
});

app.get(/^\/admin-dashboard\/$/, requireDashboardAuth, (_req, res) => {
  res.sendFile(path.join(dashboardFrontendPath, "index.html"));
});

app.get(/^\/dashboard\/.+$/, requireDashboardAuth, (_req, res) => {
  res.sendFile(path.join(dashboardFrontendPath, "index.html"));
});

app.get(/^\/admin-dashboard\/.+$/, requireDashboardAuth, (_req, res) => {
  res.sendFile(path.join(dashboardFrontendPath, "index.html"));
});

app.use("/dashboard-assets", requireDashboardAuth, (req, res, next) => {
  const relativePath = req.path
    .replace(/^\/dashboard-assets\/?/, "")
    .replace(/^\/+/, "");
  const assetPath = safeDashboardFile(dashboardFrontendPath, relativePath);
  if (!assetPath || !fs.existsSync(assetPath) || fs.statSync(assetPath).isDirectory()) {
    return res.status(404).type("text/plain").send("Dashboard asset not found.");
  }
  if (assetPath.endsWith(".css")) {
    return res.type("text/css").send(fs.readFileSync(assetPath, "utf8"));
  }
  if (assetPath.endsWith(".js") || assetPath.endsWith(".jsx")) {
    return res.type("text/javascript").send(fs.readFileSync(assetPath, "utf8"));
  }
  return res.sendFile(assetPath);
});

if (!isProduction) {
  app.get("/api/messages", (_req, res) => {
    res.json(dbOps.getContactEnquiries());
  });

  app.get("/api/vacancy-enquiries", (_req, res) => {
    res.json(dbOps.getVacancyEnquiries());
  });
}

app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((_req, res) => {
  res.status(404);
  render(res, "404", { active: "", pageTitle: "Page Not Found | HEYA Talent Solutions" });
});

const parsePort = (value, fallback) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
};

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parsePort(process.env.PORT, process.env.RENDER === "true" ? 10000 : 9000);

const server = app.listen(PORT, HOST, () => {
  console.log(`HEYA Talent Solutions website running on ${HOST}:${PORT}`);
  console.log(`Private dashboard login route: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}${getDashboardLoginPath()}`);
});

export { app, server };
