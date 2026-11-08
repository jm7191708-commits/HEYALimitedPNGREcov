import "./env.js";
import sqlite3 from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveSqlitePath = () => {
  const databaseUrl = String(
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    ""
  ).trim();

  if (/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    console.warn("PostgreSQL database URL detected. This deployment still uses the SQLite storage adapter; use SQLITE_DB_PATH on a Render disk until the PostgreSQL adapter is added.");
  }

  if (/^(sqlite|file):\/\//i.test(databaseUrl)) {
    return path.resolve(databaseUrl.replace(/^(sqlite|file):\/\//i, ""));
  }

  if (process.env.SQLITE_DB_PATH) {
    return path.resolve(process.env.SQLITE_DB_PATH);
  }

  const renderDiskPath = process.env.RENDER_DISK_MOUNT_PATH || process.env.RENDER_DATA_DIR;
  if (renderDiskPath) {
    return path.resolve(renderDiskPath, "website_data.sqlite");
  }

  return path.join(__dirname, "website_data.sqlite");
};

const dbPath = resolveSqlitePath();
const dbDir = path.dirname(dbPath);

const describePath = (targetPath) => {
  try {
    const stats = fs.statSync(targetPath);
    return {
      exists: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size
    };
  } catch (err) {
    return { exists: false, error: err.code || err.message };
  }
};

const wait = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const logDbDiagnostics = (label) => {
  console.log(`[sqlite] ${label}`);
  console.log(`[sqlite] SQLITE_DB_PATH=${process.env.SQLITE_DB_PATH || "(unset)"}`);
  console.log(`[sqlite] RENDER_DISK_MOUNT_PATH=${process.env.RENDER_DISK_MOUNT_PATH || "(unset)"}`);
  console.log(`[sqlite] resolved db path=${dbPath}`);
  console.log(`[sqlite] db directory=${dbDir} ${JSON.stringify(describePath(dbDir))}`);
  console.log(`[sqlite] db file=${JSON.stringify(describePath(dbPath))}`);
};

let db;
const maxAttempts = Number(process.env.SQLITE_OPEN_ATTEMPTS || 8);
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    db = new sqlite3(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    logDbDiagnostics(`connected on attempt ${attempt}`);
    break;
  } catch (err) {
    console.error(`[sqlite] failed to connect on attempt ${attempt}/${maxAttempts}: ${err.message}`);
    logDbDiagnostics("connection failure diagnostics");
    if (attempt === maxAttempts) {
      console.error("Failed to connect to SQLite DB:", err.message);
      process.exit(1);
    }
    wait(1000);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS contact_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    company_name TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    service_needed TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    source_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vacancy_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    industry TEXT,
    number_of_vacancies TEXT,
    location TEXT,
    employment_type TEXT,
    phone TEXT,
    email TEXT NOT NULL,
    package_interest TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    source_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

`);

const ensureColumn = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const ensureUpdatedAtColumn = (table, fallbackColumn = "submitted_at") => {
  ensureColumn(table, "updated_at", "TEXT");
  db.prepare(`
    UPDATE ${table}
    SET updated_at = COALESCE(updated_at, ${fallbackColumn}, CURRENT_TIMESTAMP)
    WHERE updated_at IS NULL OR trim(updated_at) = ''
  `).run();
};

[
  ["employment_type", "TEXT"],
  ["package_interest", "TEXT"],
  ["status", "TEXT DEFAULT 'new'"],
  ["source_path", "TEXT"],
  ["ip_address", "TEXT"],
  ["user_agent", "TEXT"]
].forEach(([column, definition]) => ensureColumn("vacancy_enquiries", column, definition));

[
  ["status", "TEXT DEFAULT 'new'"],
  ["source_path", "TEXT"],
  ["ip_address", "TEXT"],
  ["user_agent", "TEXT"]
].forEach(([column, definition]) => ensureColumn("contact_enquiries", column, definition));

ensureUpdatedAtColumn("vacancy_enquiries");
ensureUpdatedAtColumn("contact_enquiries");

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_contact_enquiries_status_submitted_at
  ON contact_enquiries(status, submitted_at);
  CREATE INDEX IF NOT EXISTS idx_contact_enquiries_updated_at
  ON contact_enquiries(updated_at);
  CREATE INDEX IF NOT EXISTS idx_vacancy_enquiries_status_submitted_at
  ON vacancy_enquiries(status, submitted_at);
  CREATE INDEX IF NOT EXISTS idx_vacancy_enquiries_updated_at
  ON vacancy_enquiries(updated_at);
`);

export const dbOps = {
  saveContactEnquiry: (data) => {
    const { fullName, companyName, email, phone, serviceNeeded, message, sourcePath, ipAddress, userAgent } = data;
    return db.prepare(`
      INSERT INTO contact_enquiries
      (full_name, company_name, email, phone, service_needed, message, source_path, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullName,
      companyName || null,
      email,
      phone || null,
      serviceNeeded || null,
      message,
      sourcePath || null,
      ipAddress || null,
      userAgent || null
    );
  },

  getContactEnquiries: () => {
    return db.prepare("SELECT * FROM contact_enquiries ORDER BY id DESC").all();
  },

  getRecentContactEnquiries: (limit = 50) => {
    return db.prepare("SELECT * FROM contact_enquiries ORDER BY id DESC LIMIT ?").all(limit);
  },

  saveVacancyEnquiry: (data) => {
    const {
      fullName,
      companyName,
      jobTitle,
      industry,
      numberOfVacancies,
      location,
      employmentType,
      phone,
      email,
      packageInterest,
      message,
      sourcePath,
      ipAddress,
      userAgent
    } = data;

    return db.prepare(`
      INSERT INTO vacancy_enquiries
      (full_name, company_name, job_title, industry, number_of_vacancies, location, employment_type, phone, email, package_interest, message, source_path, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullName,
      companyName,
      jobTitle,
      industry || null,
      numberOfVacancies || null,
      location || null,
      employmentType || null,
      phone || null,
      email,
      packageInterest || null,
      message || null,
      sourcePath || null,
      ipAddress || null,
      userAgent || null
    );
  },

  getVacancyEnquiries: () => {
    return db.prepare("SELECT * FROM vacancy_enquiries ORDER BY id DESC").all();
  },

  getRecentVacancyEnquiries: (limit = 50) => {
    return db.prepare("SELECT * FROM vacancy_enquiries ORDER BY id DESC LIMIT ?").all(limit);
  },

  getSubmissionCounts: () => {
    const contactCount = db.prepare("SELECT COUNT(*) AS count FROM contact_enquiries").get().count;
    const vacancyCount = db.prepare("SELECT COUNT(*) AS count FROM vacancy_enquiries").get().count;
    return {
      contact: contactCount,
      vacancy: vacancyCount,
      total: contactCount + vacancyCount
    };
  }
};

export default db;
