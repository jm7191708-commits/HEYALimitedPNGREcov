import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import "../env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const renderYamlPath = path.join(rootDir, "render.yaml");

const expectedValues = {
  DASHBOARD_ADMIN_EMAIL: "admin@heya.com.pg",
  // NOTE: Do not hardcode the real password here — compare against the env var at runtime.
  // DASHBOARD_ADMIN_PASSWORD is intentionally omitted from this static check.
  // DASHBOARD_ADMIN_PASSWORD: "<set-in-render-env-vars>",
  DASHBOARD_PROFILE_IMAGE_URL: "/imgs/heya-talent-solutions-mark.jpg?v=20260518",
  DASHBOARD_LOGIN_SLUG: "login",
  MCP_ENDPOINT: "https://roxannemcp.onrender.com"
};

const requiredRenderKeys = [
  "NODE_ENV",
  "HOST",
  "PORT",
  "SQLITE_DB_PATH",
  "RENDER_DISK_MOUNT_PATH",
  "DASHBOARD_ADMIN_EMAIL",
  "DASHBOARD_ADMIN_PASSWORD",
  "DASHBOARD_PROFILE_IMAGE_URL",
  "JWT_SECRET",
  "SESSION_SECRET",
  "DASHBOARD_SESSION_DURATION",
  "DASHBOARD_LOGIN_SLUG",
  "MCP_ENDPOINT",
  "MCP_API_KEY",
  "SENDGRID_ENABLED",
  "SENDGRID_API_KEY",
  "BUSINESS_EMAIL"
];

const secretRuntimeKeys = [
  "JWT_SECRET",
  "SESSION_SECRET",
  "MCP_API_KEY",
  "SENDGRID_API_KEY"
];

const readRenderEnvVars = () => {
  const yaml = fs.readFileSync(renderYamlPath, "utf8");
  const envVars = new Map();
  let currentKey = "";

  for (const line of yaml.split(/\r?\n/)) {
    const keyMatch = line.match(/^\s*-\s+key:\s*([A-Z0-9_]+)\s*$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      envVars.set(currentKey, { value: "", sync: false });
      continue;
    }

    if (!currentKey) continue;

    const valueMatch = line.match(/^\s+value:\s*(.*)\s*$/);
    if (valueMatch) {
      envVars.set(currentKey, {
        ...(envVars.get(currentKey) || {}),
        value: valueMatch[1].trim()
      });
      continue;
    }

    const syncMatch = line.match(/^\s+sync:\s*(true|false)\s*$/);
    if (syncMatch) {
      envVars.set(currentKey, {
        ...(envVars.get(currentKey) || {}),
        sync: syncMatch[1] === "true"
      });
    }
  }

  return envVars;
};

const mask = (key, value) => {
  if (!value) return "(empty)";
  if (/PASSWORD|SECRET|KEY|TOKEN/i.test(key)) return "(set)";
  return value;
};

const renderEnvVars = readRenderEnvVars();
const errors = [];
const warnings = [];
const strictRuntime = process.env.RENDER === "true" || process.env.RENDER_ENV_CHECK_STRICT === "true";

for (const key of requiredRenderKeys) {
  if (!renderEnvVars.has(key)) {
    errors.push(`render.yaml is missing ${key}.`);
  }
}

for (const [key, expected] of Object.entries(expectedValues)) {
  const configured = renderEnvVars.get(key)?.value || "";
  if (configured !== expected) {
    errors.push(`render.yaml ${key} must be ${mask(key, expected)}.`);
  }

  const runtimeValue = process.env[key] || "";
  if (runtimeValue && runtimeValue !== expected) {
    errors.push(`Runtime ${key} does not match render.yaml.`);
  } else if (!runtimeValue) {
    warnings.push(`Runtime ${key} is not set in this shell; render.yaml is configured.`);
  }
}

if (strictRuntime) {
  for (const key of secretRuntimeKeys) {
    if (!process.env[key]) {
      errors.push(`Runtime ${key} must be set in Render environment variables.`);
    }
  }
}

if (warnings.length) {
  console.warn(`[render-env] warnings:\n- ${warnings.join("\n- ")}`);
}

if (errors.length) {
  console.error(`[render-env] failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("[render-env] dashboard and Render environment configuration verified.");
