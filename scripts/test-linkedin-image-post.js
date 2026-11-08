import fs from "fs";
import path from "path";

import "../env.js";

const args = new Set(process.argv.slice(2));
const publish = args.has("--publish");

const endpoint = String(process.env.MCP_ENDPOINT || process.env.ROXANNE_MCP_ENDPOINT || "").replace(/\/+$/, "");
const apiKey = String(process.env.MCP_API_KEY || process.env.ROXANNE_MCP_API_KEY || "").trim();
const userId = String(process.env.TEST_MCP_USER_ID || "heya:admin@heya.com.pg").trim();
const text = String(
  process.env.TEST_LINKEDIN_POST_TEXT ||
  "Testing a LinkedIn image post from the HEYA dashboard MCP proxy."
).trim();
const imagePath = path.resolve(
  process.env.TEST_LINKEDIN_IMAGE_PATH ||
  path.join("public", "imgs", "heya-talent-solutions-mark.jpg")
);

const mimeByExt = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

if (!endpoint) {
  console.error("Missing MCP_ENDPOINT.");
  process.exit(1);
}

if (!apiKey) {
  console.error("Missing MCP_API_KEY.");
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`Image file not found: ${imagePath}`);
  process.exit(1);
}

const imageName = path.basename(imagePath);
const imageMimeType = mimeByExt[path.extname(imagePath).toLowerCase()] || "application/octet-stream";
const imageBase64 = fs.readFileSync(imagePath).toString("base64");

const payload = {
  tool: "linkedin_post",
  provider: "linkedin",
  userId,
  text,
  dryRun: !publish,
  image: {
    filename: imageName,
    mimeType: imageMimeType,
    contentBase64: imageBase64,
    altText: "HEYA Talent Solutions image post test"
  },
  media: [
    {
      type: "image",
      filename: imageName,
      mimeType: imageMimeType,
      contentBase64: imageBase64,
      altText: "HEYA Talent Solutions image post test"
    }
  ]
};

const response = await fetch(`${endpoint}/execute`, {
  method: "POST",
  headers: {
    "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
    "Authorization": `Bearer ${apiKey}`,
    "x-mcp-api-key": apiKey,
    "x-heya-mcp-source": "heya-dashboard-script",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

const raw = await response.text();
let data = null;
try {
  data = raw ? JSON.parse(raw) : null;
} catch {
  data = null;
}

console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  statusText: response.statusText,
  endpoint,
  mode: publish ? "publish" : "dry-run",
  userId,
  image: {
    path: imagePath,
    filename: imageName,
    mimeType: imageMimeType,
    bytes: fs.statSync(imagePath).size
  },
  data,
  raw: data ? undefined : raw.slice(0, 1000)
}, null, 2));

if (!response.ok) {
  process.exit(1);
}
