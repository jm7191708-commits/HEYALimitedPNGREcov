import "./env.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import db from "./db.js";
import {
  createApplicantCode,
  getApplicantDisplayName,
  normalizeApplicantInput,
  normalizeEmail
} from "./applicant-identity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = process.env.CAREERS_UPLOAD_DIR
  ? path.resolve(process.env.CAREERS_UPLOAD_DIR)
  : path.join(__dirname, "data", "uploads", "careers");

const maxUploadMb = Number(process.env.CAREERS_UPLOAD_MAX_MB || 5);
const maxUploadBytes = (Number.isFinite(maxUploadMb) && maxUploadMb > 0 ? maxUploadMb : 5) * 1024 * 1024;
const documentUploadExtensions = new Set([".pdf", ".doc", ".docx", ".rtf", ".txt"]);
const imageUploadExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const documentUploadMimePrefixes = [
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
  "text/pdf",
  "text/x-pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
  "text/plain"
];
const imageUploadMimePrefixes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
];

fs.mkdirSync(uploadsRoot, { recursive: true });

const nowIso = () => new Date().toISOString();
const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const cleanMultiline = (value) => String(value || "").replace(/\r\n/g, "\n").trim();
const externalHref = (value) => {
  const url = cleanText(value);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://${url.replace(/^\/+/, "")}`;
};
const toInt = (value, fallback = null) => {
  const next = Number.parseInt(value, 10);
  return Number.isInteger(next) ? next : fallback;
};
const boolInt = (value) => (value ? 1 : 0);
const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const parseSince = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
const OFFER_STATUSES = new Set(["pending", "closed", "rejected", "deleted"]);
const APPLICATION_WORKFLOW_STATUSES = new Set([
  "applied",
  "screening",
  "screened",
  "shortlist_eligible",
  "shortlisted",
  "talent_pool",
  "interview",
  "final_review",
  "offer",
  "hired",
  "rejected",
  "closed",
  "not_shortlisted",
  "deleted",
  "new"
]);
const SHORTLIST_REVIEW_DECISIONS = new Set(["proceed", "hold", "reject", "needs-more-review"]);
const SHORTLIST_ASSESSMENT_RECOMMENDATIONS = new Set(["strong-proceed", "proceed", "hold", "reject", "needs-more-review"]);
const NON_SHORTLISTED_ACTIONS = new Set(["talent_pool", "not_shortlisted", "rejected", "deleted"]);
const parseBool = (value) => {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = cleanText(value).toLowerCase();
    if (normalized === "true" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "no") return false;
  }
  return false;
};
const splitCsv = (value) => cleanText(value)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const dashboardTimestampExpr = "COALESCE(updated_at, created_at)";
const messageTimestampExpr = "COALESCE(updated_at, received_at, created_at)";
const normalizeApplicationStatus = (value, fallback = "applied") => {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "new") return "applied";
  return APPLICATION_WORKFLOW_STATUSES.has(normalized) ? normalized : fallback;
};
const applicantIdentityFrom = (input = {}) => normalizeApplicantInput({
  fullName: input.fullName ?? input.full_name ?? input.name,
  firstName: input.firstName ?? input.first_name,
  lastName: input.lastName ?? input.last_name,
  email: input.email,
  normalizedEmail: input.normalizedEmail ?? input.normalized_email,
  phone: input.phone,
  positionId: input.positionId ?? input.job_posting_id,
  positionTitle: input.positionTitle ?? input.job_title,
  status: input.status,
  createdAt: input.createdAt ?? input.created_at,
  updatedAt: input.updatedAt ?? input.updated_at
});

db.exec(`
  CREATE TABLE IF NOT EXISTS career_job_postings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    company_name TEXT,
    department TEXT,
    industry TEXT,
    location TEXT,
    employment_type TEXT,
    number_of_vacancies INTEGER,
    salary_display TEXT,
    level TEXT,
    start_date TEXT,
    closing_date TEXT,
    description TEXT,
    responsibilities TEXT,
    requirements TEXT,
    contact_person TEXT,
    reason_for_hiring TEXT,
    cover_letter_required INTEGER DEFAULT 0,
    featured INTEGER DEFAULT 0,
    urgent INTEGER DEFAULT 0,
    applied INTEGER DEFAULT 0,
    approved INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    checklist_json TEXT,
    source_submission_id INTEGER,
    approved_at TEXT,
    published_at TEXT,
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_employer_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    industry TEXT,
    number_of_vacancies INTEGER,
    location TEXT,
    employment_type TEXT,
    phone TEXT,
    email TEXT NOT NULL,
    package_interest TEXT,
    salary_display TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    linked_job_posting_id INTEGER,
    source_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER NOT NULL,
    relative_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_applicants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT NOT NULL,
    normalized_email TEXT NOT NULL UNIQUE,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_job_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_code TEXT NOT NULL UNIQUE,
    applicant_id INTEGER,
    job_posting_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    normalized_email TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    current_location TEXT,
    years_experience TEXT,
    cover_letter_text TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    offer_status TEXT,
    offer_status_updated_at TEXT,
    offer_closed_at TEXT,
    offer_deleted_at TEXT,
    offer_history_json TEXT,
    shortlist_review_json TEXT,
    shortlist_report_json TEXT,
    shortlist_review_saved_at TEXT,
    cv_file_id INTEGER,
    cover_letter_file_id INTEGER,
    source_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_talent_pool_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_code TEXT NOT NULL UNIQUE,
    applicant_id INTEGER,
    full_name TEXT NOT NULL,
    normalized_email TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    current_location TEXT,
    years_experience TEXT,
    desired_roles TEXT,
    industries TEXT,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    cv_file_id INTEGER,
    cover_letter_file_id INTEGER,
    source_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'unread',
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    subject TEXT,
    body TEXT,
    service_needed TEXT,
    current_location TEXT,
    years_experience TEXT,
    desired_roles TEXT,
    industries TEXT,
    position_id INTEGER,
    position_title TEXT,
    cv_file_id INTEGER,
    cover_letter_file_id INTEGER,
    linked_talent_pool_submission_id INTEGER,
    linked_applicant_id INTEGER,
    linked_application_id INTEGER,
    source_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'dashboard',
    status TEXT NOT NULL DEFAULT 'unread',
    title TEXT NOT NULL,
    detail TEXT,
    tone TEXT DEFAULT 'info',
    related_type TEXT,
    related_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_screenings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_posting_id INTEGER NOT NULL UNIQUE,
    criteria_json TEXT,
    rankings_json TEXT,
    pushed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_screening_tie_breaker_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_posting_id INTEGER NOT NULL,
    screening_id INTEGER,
    screening_run_id TEXT,
    criteria_type TEXT NOT NULL DEFAULT 'tie_breaker',
    criteria_name TEXT NOT NULL,
    criteria_description TEXT,
    max_points REAL NOT NULL DEFAULT 1.0,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS career_screening_applicants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screening_id INTEGER NOT NULL,
    application_id INTEGER NOT NULL UNIQUE,
    screening_status TEXT NOT NULL DEFAULT 'not-started',
    scores_json TEXT,
    ai_json TEXT,
    report_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shortlisting_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id INTEGER NOT NULL,
    created_by TEXT,
    criteria_name TEXT NOT NULL,
    criteria_payload TEXT,
    threshold_score REAL NOT NULL DEFAULT 60,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shortlisted_applicants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    applicant_id INTEGER NOT NULL,
    position_id INTEGER NOT NULL,
    screening_result_id INTEGER,
    shortlisting_result_id INTEGER,
    shortlisting_criteria_id INTEGER,
    shortlist_score REAL,
    shortlist_reason TEXT,
    pushed_by TEXT,
    pushed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id, position_id)
  );

  CREATE TABLE IF NOT EXISTS shortlisted_final_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_id INTEGER NOT NULL,
    application_id INTEGER NOT NULL UNIQUE,
    position_id INTEGER NOT NULL,
    reference_checks_completed INTEGER NOT NULL DEFAULT 0,
    background_check_completed INTEGER NOT NULL DEFAULT 0,
    credential_verification_completed INTEGER NOT NULL DEFAULT 0,
    employment_history_verified INTEGER NOT NULL DEFAULT 0,
    required_qualifications_confirmed INTEGER NOT NULL DEFAULT 0,
    final_interview_completed INTEGER NOT NULL DEFAULT 0,
    final_assessment_completed INTEGER NOT NULL DEFAULT 0,
    hiring_manager_recommendation_completed INTEGER NOT NULL DEFAULT 0,
    ready_for_board_review INTEGER NOT NULL DEFAULT 0,
    salary_expectations_reviewed INTEGER NOT NULL DEFAULT 0,
    availability_confirmed INTEGER NOT NULL DEFAULT 0,
    final_recommendation TEXT,
    checklist_notes TEXT,
    generated_report TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  /* ── Improvement 1: Application stage history ──────────────────────────── */
  CREATE TABLE IF NOT EXISTS career_application_stage_history (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL
                     REFERENCES career_job_applications(id) ON DELETE CASCADE,
    from_stage     TEXT,
    to_stage       TEXT NOT NULL,
    changed_by     TEXT NOT NULL DEFAULT 'admin',
    reason         TEXT,
    notes          TEXT,
    changed_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  /* ── Improvement 3a: Controlled rejection reasons ──────────────────────── */
  CREATE TABLE IF NOT EXISTS career_rejection_reasons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  /* ── Improvement 4: Dedicated offers table ─────────────────────────────── */
  CREATE TABLE IF NOT EXISTS career_offers (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id    INTEGER NOT NULL
                        REFERENCES career_job_applications(id) ON DELETE CASCADE,
    offer_status      TEXT NOT NULL DEFAULT 'pending',
    salary_notes      TEXT,
    proposed_start    TEXT,
    issued_at         TEXT,
    expires_at        TEXT,
    responded_at      TEXT,
    rejection_reason  TEXT,
    notes             TEXT,
    history_json      TEXT,
    created_by        TEXT NOT NULL DEFAULT 'admin',
    created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const getTableColumns = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
const ensureTableColumn = (table, column, definition) => {
  const columns = getTableColumns(table);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};
const ensureUpdatedAtColumn = (table) => {
  const columns = getTableColumns(table);
  if (!columns.includes("updated_at")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT`);
  }
  db.prepare(`
    UPDATE ${table}
    SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    WHERE updated_at IS NULL OR trim(updated_at) = ''
  `).run();
};

[
  "career_applicants",
  "career_job_postings",
  "career_employer_submissions",
  "career_job_applications",
  "career_talent_pool_submissions",
  "career_messages",
  "career_notifications",
  "career_screenings",
  "career_screening_tie_breaker_criteria",
  "career_screening_applicants",
  "shortlisting_criteria",
  "shortlisted_applicants",
  "shortlisted_final_checklists"
].forEach(ensureUpdatedAtColumn);

[
  ["career_job_applications", "applicant_id", "INTEGER"],
  ["career_job_applications", "normalized_email", "TEXT"],
  ["career_talent_pool_submissions", "applicant_id", "INTEGER"],
  ["career_talent_pool_submissions", "normalized_email", "TEXT"],
  ["career_messages", "linked_applicant_id", "INTEGER"]
].forEach(([table, column, definition]) => ensureTableColumn(table, column, definition));

[
  ["company_address", "TEXT"],
  ["contact_person_role", "TEXT"],
  ["job_category", "TEXT"],
  ["application_deadline", "TEXT"],
  ["job_description", "TEXT"],
  ["job_criteria", "TEXT"],
  ["minimum_qualifications", "TEXT"],
  ["required_experience", "TEXT"],
  ["required_skills", "TEXT"],
  ["application_instructions", "TEXT"],
  ["application_instructions_file_id", "INTEGER"],
  ["supporting_notes", "TEXT"],
  ["additional_message", "TEXT"],
  ["career_site_url", "TEXT"]
].forEach(([column, definition]) => ensureTableColumn("career_employer_submissions", column, definition));

[
  ["preferred_work_location", "TEXT"],
  ["highest_qualification", "TEXT"],
  ["key_skills", "TEXT"],
  ["availability", "TEXT"],
  ["cv_link", "TEXT"],
  ["cover_letter_link", "TEXT"],
  ["cover_letter_text", "TEXT"],
  ["additional_notes", "TEXT"],
  ["tags", "TEXT"],
  ["last_contacted_at", "TEXT"],
  ["consent_expires_at", "TEXT"]
].forEach(([column, definition]) => ensureTableColumn("career_talent_pool_submissions", column, definition));

const screeningApplicantColumns = db.prepare("PRAGMA table_info(career_screening_applicants)").all();
if (!screeningApplicantColumns.some((column) => column.name === "saved_at")) {
  db.exec("ALTER TABLE career_screening_applicants ADD COLUMN saved_at TEXT");
}
[
  ["screening_score", "REAL"],
  ["tie_breaker_criteria_id", "INTEGER"],
  ["tie_breaker_points", "REAL NOT NULL DEFAULT 0"],
  ["final_score", "REAL"],
  ["tie_breaker_reviewed", "INTEGER NOT NULL DEFAULT 0"],
  ["sort_order", "INTEGER"],
  ["shortlist_decision", "TEXT"],
  ["shortlist_decided_at", "TEXT"],
  ["shortlist_decided_by", "TEXT"]
].forEach(([column, definition]) => ensureTableColumn("career_screening_applicants", column, definition));
[
  ["last_sorted_at", "TEXT"],
  ["last_sorted_by", "TEXT"],
  ["last_sort_direction", "TEXT"],
  ["tie_breaker_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ["ranking_needs_refresh", "INTEGER NOT NULL DEFAULT 0"]
].forEach(([column, definition]) => ensureTableColumn("career_screenings", column, definition));
const applicationColumns = db.prepare("PRAGMA table_info(career_job_applications)").all();
if (!applicationColumns.some((column) => column.name === "shortlist_review_json")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN shortlist_review_json TEXT");
}
if (!applicationColumns.some((column) => column.name === "shortlist_report_json")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN shortlist_report_json TEXT");
}
if (!applicationColumns.some((column) => column.name === "shortlist_review_saved_at")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN shortlist_review_saved_at TEXT");
}
if (!applicationColumns.some((column) => column.name === "offer_status")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN offer_status TEXT");
}
if (!applicationColumns.some((column) => column.name === "offer_status_updated_at")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN offer_status_updated_at TEXT");
}
if (!applicationColumns.some((column) => column.name === "offer_closed_at")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN offer_closed_at TEXT");
}
if (!applicationColumns.some((column) => column.name === "offer_deleted_at")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN offer_deleted_at TEXT");
}
if (!applicationColumns.some((column) => column.name === "offer_history_json")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN offer_history_json TEXT");
}
if (!applicationColumns.some((column) => column.name === "id_photo_file_id")) {
  db.exec("ALTER TABLE career_job_applications ADD COLUMN id_photo_file_id INTEGER");
}
ensureTableColumn("career_job_postings", "filtration_json", "TEXT");
ensureTableColumn("career_job_postings", "external_apply_url", "TEXT");
ensureTableColumn("career_job_postings", "company_description", "TEXT");
ensureTableColumn("career_job_postings", "company_logo_file_id", "INTEGER");
ensureTableColumn("career_job_postings", "cover_photo_file_id", "INTEGER");
ensureTableColumn("career_job_postings", "external_links", "TEXT");

/* ── Pipedrive CRM columns ─────────────────────────────────────────────── */
ensureTableColumn("career_job_applications", "pipedrive_person_id", "INTEGER");
ensureTableColumn("career_job_applications", "pipedrive_deal_id",   "INTEGER");
ensureTableColumn("career_job_postings",     "pipedrive_org_id",    "INTEGER");
ensureTableColumn("career_job_postings",     "pipedrive_deal_id",   "INTEGER");

/* ── Improvement 2: File verification status ───────────────────────────── */
ensureTableColumn("career_files", "verification_status", "TEXT NOT NULL DEFAULT 'pending_review'");
ensureTableColumn("career_files", "verified_by",         "TEXT");
ensureTableColumn("career_files", "verified_at",         "TEXT");
ensureTableColumn("career_files", "verification_notes",  "TEXT");

/* ── Improvement 3b: Rejection link on applications ───────────────────── */
ensureTableColumn("career_job_applications", "rejection_reason_id", "INTEGER");
ensureTableColumn("career_job_applications", "rejection_notes",     "TEXT");

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_career_applicants_normalized_email
  ON career_applicants(normalized_email);
  CREATE INDEX IF NOT EXISTS idx_career_job_postings_status_created_at
  ON career_job_postings(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_career_job_postings_updated_at
  ON career_job_postings(updated_at);
  CREATE INDEX IF NOT EXISTS idx_career_employer_submissions_status_created_at
  ON career_employer_submissions(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_career_employer_submissions_updated_at
  ON career_employer_submissions(updated_at);
  CREATE INDEX IF NOT EXISTS idx_career_job_applications_status_created_at
  ON career_job_applications(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_career_job_applications_updated_at
  ON career_job_applications(updated_at);
  CREATE INDEX IF NOT EXISTS idx_career_job_applications_applicant_id
  ON career_job_applications(applicant_id);
  CREATE INDEX IF NOT EXISTS idx_career_job_applications_position_id
  ON career_job_applications(job_posting_id);
  CREATE INDEX IF NOT EXISTS idx_career_talent_pool_submissions_status_created_at
  ON career_talent_pool_submissions(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_career_talent_pool_submissions_updated_at
  ON career_talent_pool_submissions(updated_at);
  CREATE INDEX IF NOT EXISTS idx_career_talent_pool_submissions_applicant_id
  ON career_talent_pool_submissions(applicant_id);
  CREATE INDEX IF NOT EXISTS idx_career_notifications_created_at
  ON career_notifications(created_at);
  CREATE INDEX IF NOT EXISTS idx_career_notifications_updated_at
  ON career_notifications(updated_at);
  CREATE INDEX IF NOT EXISTS idx_career_messages_created_at
  ON career_messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_career_messages_updated_at
  ON career_messages(updated_at);
  CREATE INDEX IF NOT EXISTS idx_career_messages_status_kind_received_at
  ON career_messages(status, kind, received_at);
  CREATE INDEX IF NOT EXISTS idx_applications_position_status
  ON career_job_applications(job_posting_id, status);
  CREATE INDEX IF NOT EXISTS idx_screening_criteria_position
  ON career_screenings(job_posting_id);
  CREATE INDEX IF NOT EXISTS idx_shortlisting_criteria_position
  ON shortlisting_criteria(position_id);
  CREATE INDEX IF NOT EXISTS idx_shortlisted_position
  ON shortlisted_applicants(position_id);
  CREATE INDEX IF NOT EXISTS idx_shortlisted_application
  ON shortlisted_applicants(application_id);
  CREATE INDEX IF NOT EXISTS idx_shortlisted_status
  ON shortlisted_applicants(status);
  CREATE INDEX IF NOT EXISTS idx_shortlisted_final_checklists_applicant_id
  ON shortlisted_final_checklists(applicant_id);
  CREATE INDEX IF NOT EXISTS idx_shortlisted_final_checklists_application_id
  ON shortlisted_final_checklists(application_id);
  CREATE INDEX IF NOT EXISTS idx_shortlisted_final_checklists_position_id
  ON shortlisted_final_checklists(position_id);
  CREATE INDEX IF NOT EXISTS idx_career_notifications_related
  ON career_notifications(related_type, related_id);

  CREATE INDEX IF NOT EXISTS idx_stage_history_application_id
  ON career_application_stage_history(application_id);
  CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at
  ON career_application_stage_history(changed_at);

  CREATE INDEX IF NOT EXISTS idx_career_offers_application_id
  ON career_offers(application_id);
  CREATE INDEX IF NOT EXISTS idx_career_offers_status
  ON career_offers(offer_status);
`);

/* ── Seed rejection reasons ───────────────────────────────────────────────── */
(function seedRejectionReasons() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM career_rejection_reasons").get().n;
  if (existing > 0) return;
  const insert = db.prepare(
    "INSERT INTO career_rejection_reasons (code, description) VALUES (?, ?)"
  );
  const seed = db.transaction(() => {
    [
      ["does_not_meet_requirements",  "Does not meet minimum requirements"],
      ["insufficient_experience",     "Insufficient experience"],
      ["failed_screening",            "Failed screening assessment"],
      ["failed_interview",            "Failed interview"],
      ["position_filled",             "Position has been filled"],
      ["salary_expectation_mismatch", "Salary expectation mismatch"],
      ["withdrawn_by_candidate",      "Withdrawn by candidate"],
      ["unsuccessful_talent_pool",    "Unsuccessful but added to talent pool"],
      ["incomplete_application",      "Incomplete application submitted"],
      ["no_right_to_work",            "No right to work / visa requirements not met"],
      ["other",                       "Other"]
    ].forEach(([code, description]) => insert.run(code, description));
  });
  seed();
  console.log("[heya-db] ✓ Rejection reasons seeded.");
}());

/* ── Migrate existing offer data into career_offers ───────────────────────── */
(function migrateOffersTable() {
  const alreadyMigrated = db.prepare("SELECT COUNT(*) AS n FROM career_offers").get().n;
  if (alreadyMigrated > 0) return;

  const offerRows = db.prepare(`
    SELECT id, offer_status, offer_status_updated_at, offer_closed_at,
           offer_deleted_at, offer_history_json, status, created_at
    FROM career_job_applications
    WHERE offer_status IS NOT NULL
       OR lower(status) IN ('offer', 'hired')
  `).all();

  if (!offerRows.length) return;

  const insert = db.prepare(`
    INSERT INTO career_offers
      (application_id, offer_status, history_json, issued_at, responded_at, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)
  `);

  const migrate = db.transaction(() => {
    for (const row of offerRows) {
      const status = row.offer_status
        || (row.status === "hired" ? "closed" : row.status === "offer" ? "pending" : "pending");
      const respondedAt = row.offer_closed_at || row.offer_deleted_at || null;
      const ts = row.offer_status_updated_at || row.created_at || nowIso();
      insert.run(
        row.id,
        status,
        row.offer_history_json || null,
        ts,
        respondedAt,
        row.created_at || nowIso(),
        ts
      );
    }
  });
  migrate();
  console.log(`[heya-db] ✓ Migrated ${offerRows.length} offer record(s) into career_offers.`);
}());

/* ── FK Migration: career_job_applications → career_job_postings ─────────────
 *
 * The original DDL had job_posting_id INTEGER NOT NULL but no REFERENCES clause,
 * so SQLite never enforced the foreign key even with foreign_keys = ON.
 * This migration runs once at startup: it checks whether the constraint is
 * already declared (PRAGMA foreign_key_list returns rows), and if not, safely
 * recreates the table with ON DELETE CASCADE so the relationship is enforced
 * at the database level from this point forward.
 * ─────────────────────────────────────────────────────────────────────────── */
(function runFkMigration() {
  const existingFks = db.prepare("PRAGMA foreign_key_list(career_job_applications)").all();
  if (existingFks.length > 0) return; // Already migrated — nothing to do.

  // Check for orphaned rows before touching the table.
  const { orphanCount } = db.prepare(`
    SELECT COUNT(*) AS orphanCount FROM career_job_applications
    WHERE job_posting_id NOT IN (SELECT id FROM career_job_postings)
  `).get();

  if (orphanCount > 0) {
    console.warn(`[heya-db] ⚠  ${orphanCount} orphaned application(s) detected `
      + `(job_posting_id references a non-existent position). `
      + `FK migration skipped — resolve orphans first via /api/admin/db/integrity-check.`);
    return;
  }

  // Snapshot column names from the live table so new columns added via
  // ensureTableColumn() (e.g. id_photo_file_id) are always included.
  const liveCols = db.prepare("PRAGMA table_info(career_job_applications)").all().map((c) => c.name);

  // PRAGMA foreign_keys must be toggled outside a transaction in SQLite.
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE __cja_migrated (
          id                         INTEGER PRIMARY KEY AUTOINCREMENT,
          application_code           TEXT    NOT NULL UNIQUE,
          applicant_id               INTEGER,
          job_posting_id             INTEGER NOT NULL
                                       REFERENCES career_job_postings(id) ON DELETE CASCADE,
          full_name                  TEXT    NOT NULL,
          normalized_email           TEXT,
          email                      TEXT    NOT NULL,
          phone                      TEXT    NOT NULL,
          current_location           TEXT,
          years_experience           TEXT,
          cover_letter_text          TEXT,
          status                     TEXT    NOT NULL DEFAULT 'new',
          offer_status               TEXT,
          offer_status_updated_at    TEXT,
          offer_closed_at            TEXT,
          offer_deleted_at           TEXT,
          offer_history_json         TEXT,
          shortlist_review_json      TEXT,
          shortlist_report_json      TEXT,
          shortlist_review_saved_at  TEXT,
          cv_file_id                 INTEGER,
          cover_letter_file_id       INTEGER,
          id_photo_file_id           INTEGER,
          source_path                TEXT,
          ip_address                 TEXT,
          user_agent                 TEXT,
          created_at                 TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at                 TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Copy only columns that exist in both source and destination.
      const destCols  = db.prepare("PRAGMA table_info(__cja_migrated)").all().map((c) => c.name);
      const shareCols = liveCols.filter((c) => destCols.includes(c)).join(", ");
      db.exec(`INSERT INTO __cja_migrated (${shareCols}) SELECT ${shareCols} FROM career_job_applications`);

      db.exec("DROP TABLE career_job_applications");
      db.exec("ALTER TABLE __cja_migrated RENAME TO career_job_applications");

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_career_job_applications_status_created_at
          ON career_job_applications(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_career_job_applications_updated_at
          ON career_job_applications(updated_at);
        CREATE INDEX IF NOT EXISTS idx_career_job_applications_applicant_id
          ON career_job_applications(applicant_id);
        CREATE INDEX IF NOT EXISTS idx_career_job_applications_position_id
          ON career_job_applications(job_posting_id);
        CREATE INDEX IF NOT EXISTS idx_applications_position_status
          ON career_job_applications(job_posting_id, status);
      `);

      const violations = db.prepare("PRAGMA foreign_key_check(career_job_applications)").all();
      if (violations.length > 0) throw new Error(`FK check found ${violations.length} violation(s).`);
    })();

    console.log("[heya-db] ✓ FK migration complete: career_job_applications.job_posting_id "
      + "→ career_job_postings(id) ON DELETE CASCADE");
  } catch (err) {
    console.error("[heya-db] ✗ FK migration failed:", err.message);
  } finally {
    db.pragma("foreign_keys = ON");
  }
}());

/* ── DB Integrity Check ───────────────────────────────────────────────────── */
const integrityCheck = () => {
  const orphanedApplications = db.prepare(`
    SELECT a.id, a.application_code, a.full_name, a.email, a.job_posting_id
    FROM career_job_applications a
    WHERE a.job_posting_id NOT IN (SELECT id FROM career_job_postings)
    ORDER BY a.id
  `).all();

  const nullPositionApplications = db.prepare(`
    SELECT id, application_code, full_name FROM career_job_applications
    WHERE job_posting_id IS NULL
    ORDER BY id
  `).all();

  const positionCounts = db.prepare(`
    SELECT p.id, p.reference_code, p.title, p.status,
           COUNT(a.id) AS application_count
    FROM career_job_postings p
    LEFT JOIN career_job_applications a ON a.job_posting_id = p.id
    GROUP BY p.id
    ORDER BY p.id
  `).all();

  const orphanedScreenings = db.prepare(`
    SELECT s.id, s.job_posting_id FROM career_screenings s
    WHERE s.job_posting_id NOT IN (SELECT id FROM career_job_postings)
    ORDER BY s.id
  `).all();

  const orphanedShortlisted = db.prepare(`
    SELECT sa.id, sa.application_id, sa.position_id FROM shortlisted_applicants sa
    WHERE sa.position_id NOT IN (SELECT id FROM career_job_postings)
       OR sa.application_id NOT IN (SELECT id FROM career_job_applications)
    ORDER BY sa.id
  `).all();

  const fkViolations = db.prepare("PRAGMA foreign_key_check").all();

  const fkDeclared = db.prepare("PRAGMA foreign_key_list(career_job_applications)").all().length > 0;

  const totalApplications = db.prepare("SELECT COUNT(*) AS n FROM career_job_applications").get().n;
  const totalPositions    = db.prepare("SELECT COUNT(*) AS n FROM career_job_postings").get().n;

  const issueCount =
    orphanedApplications.length +
    nullPositionApplications.length +
    orphanedScreenings.length +
    orphanedShortlisted.length +
    fkViolations.length;

  return {
    ok: issueCount === 0,
    fkConstraintDeclared: fkDeclared,
    totalPositions,
    totalApplications,
    issueCount,
    summary: issueCount === 0
      ? `All checks passed. ${totalPositions} position(s), ${totalApplications} application(s). FK constraint is ${fkDeclared ? "enforced" : "NOT enforced"}.`
      : `${issueCount} integrity issue(s) found across ${totalPositions} positions and ${totalApplications} applications.`,
    orphanedApplications,
    nullPositionApplications,
    positionCounts,
    orphanedScreenings,
    orphanedShortlisted,
    fkViolations
  };
};

const mapApplicantRow = (row) => {
  if (!row) return null;
  const applicant = applicantIdentityFrom(row);
  return {
    id: String(row.id),
    applicantId: String(row.id),
    userId: String(row.id),
    applicantCode: row.applicant_code,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    fullName: getApplicantDisplayName(applicant),
    name: getApplicantDisplayName(applicant),
    email: row.email,
    normalizedEmail: row.normalized_email,
    phone: row.phone || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const getApplicantById = (id) => {
  const applicantId = toInt(id);
  if (!applicantId) return null;
  const row = db.prepare("SELECT * FROM career_applicants WHERE id = ?").get(applicantId);
  return mapApplicantRow(row);
};

const findApplicantRowByNormalizedEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return db.prepare("SELECT * FROM career_applicants WHERE normalized_email = ?").get(normalized);
};

const ensureApplicantIdentity = (input = {}) => {
  const applicant = applicantIdentityFrom(input);
  if (!applicant.normalizedEmail) {
    throw new Error("A valid applicant email is required.");
  }

  const existingId = toInt(input.applicantId || input.userId || input.id);
  const existing = existingId
    ? db.prepare("SELECT * FROM career_applicants WHERE id = ?").get(existingId)
    : findApplicantRowByNormalizedEmail(applicant.normalizedEmail);
  const timestamp = nowIso();

  if (existing) {
    const nextFullName = applicant.fullName || existing.full_name;
    const nextNames = applicantIdentityFrom({
      fullName: nextFullName,
      firstName: applicant.firstName || existing.first_name,
      lastName: applicant.lastName || existing.last_name,
      email: applicant.email || existing.email,
      phone: applicant.phone || existing.phone
    });
    db.prepare(`
      UPDATE career_applicants
      SET full_name = ?,
          first_name = ?,
          last_name = ?,
          email = ?,
          normalized_email = ?,
          phone = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      nextNames.fullName,
      nextNames.firstName || null,
      nextNames.lastName || null,
      applicant.email || existing.email,
      applicant.normalizedEmail,
      applicant.phone || existing.phone || null,
      timestamp,
      existing.id
    );
    return getApplicantById(existing.id);
  }

  const insert = db.prepare(`
    INSERT INTO career_applicants (
      applicant_code, full_name, first_name, last_name, email, normalized_email, phone, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createApplicantCode(),
    applicant.fullName,
    applicant.firstName || null,
    applicant.lastName || null,
    applicant.email,
    applicant.normalizedEmail,
    applicant.phone || null,
    timestamp,
    timestamp
  );
  return getApplicantById(Number(insert.lastInsertRowid));
};

const backfillApplicantIdentityLinks = () => {
  // Short-circuit if nothing needs linking — avoids a full-table scan on every startup
  const unlinkedApplications = db.prepare("SELECT COUNT(*) AS cnt FROM career_job_applications WHERE applicant_id IS NULL").get()?.cnt || 0;
  const unlinkedTalent = db.prepare("SELECT COUNT(*) AS cnt FROM career_talent_pool_submissions WHERE applicant_id IS NULL").get()?.cnt || 0;
  if (!unlinkedApplications && !unlinkedTalent) return;

  const transaction = db.transaction(() => {
    const applications = db.prepare(`
      SELECT *
      FROM career_job_applications
      ORDER BY id ASC
    `).all();

    applications.forEach((row) => {
      const applicant = ensureApplicantIdentity({
        applicantId: row.applicant_id,
        fullName: row.full_name,
        email: row.email,
        normalizedEmail: row.normalized_email,
        phone: row.phone
      });
      db.prepare(`
        UPDATE career_job_applications
        SET applicant_id = ?,
            full_name = ?,
            normalized_email = ?,
            email = ?,
            phone = ?,
            updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
        WHERE id = ?
      `).run(
        Number(applicant.id),
        applicant.fullName,
        applicant.normalizedEmail,
        applicant.email,
        applicant.phone || row.phone,
        row.id
      );
    });

    const talentRows = db.prepare(`
      SELECT *
      FROM career_talent_pool_submissions
      ORDER BY id ASC
    `).all();

    talentRows.forEach((row) => {
      const applicant = ensureApplicantIdentity({
        applicantId: row.applicant_id,
        fullName: row.full_name,
        email: row.email,
        normalizedEmail: row.normalized_email,
        phone: row.phone
      });
      db.prepare(`
        UPDATE career_talent_pool_submissions
        SET applicant_id = ?,
            full_name = ?,
            normalized_email = ?,
            email = ?,
            phone = ?
        WHERE id = ?
      `).run(
        Number(applicant.id),
        applicant.fullName,
        applicant.normalizedEmail,
        applicant.email,
        applicant.phone || row.phone,
        row.id
      );
    });

    const messages = db.prepare(`
      SELECT id, kind, email, linked_application_id, linked_talent_pool_submission_id, linked_applicant_id
      FROM career_messages
      ORDER BY id ASC
    `).all();

    messages.forEach((row) => {
      let applicantId = toInt(row.linked_applicant_id);
      if (!applicantId && row.linked_application_id) {
        applicantId = toInt(db.prepare("SELECT applicant_id FROM career_job_applications WHERE id = ?").get(row.linked_application_id)?.applicant_id);
      }
      if (!applicantId && row.linked_talent_pool_submission_id) {
        applicantId = toInt(db.prepare("SELECT applicant_id FROM career_talent_pool_submissions WHERE id = ?").get(row.linked_talent_pool_submission_id)?.applicant_id);
      }
      if (!applicantId && ["job-application", "cv-submission"].includes(row.kind) && normalizeEmail(row.email)) {
        applicantId = toInt(ensureApplicantIdentity({ email: row.email }).id);
      }
      if (applicantId) {
        db.prepare(`
          UPDATE career_messages
          SET linked_applicant_id = ?
          WHERE id = ?
        `).run(applicantId, row.id);
      }
    });

    db.prepare(`
      UPDATE shortlisted_applicants
      SET applicant_id = (
        SELECT applicant_id
        FROM career_job_applications
        WHERE career_job_applications.id = shortlisted_applicants.application_id
      )
      WHERE (applicant_id IS NULL OR applicant_id = application_id)
        AND EXISTS (
          SELECT 1
          FROM career_job_applications
          WHERE career_job_applications.id = shortlisted_applicants.application_id
            AND career_job_applications.applicant_id IS NOT NULL
        )
    `).run();

    db.prepare(`
      UPDATE shortlisted_final_checklists
      SET applicant_id = (
        SELECT applicant_id
        FROM career_job_applications
        WHERE career_job_applications.id = shortlisted_final_checklists.application_id
      )
      WHERE (applicant_id IS NULL OR applicant_id = application_id)
        AND EXISTS (
          SELECT 1
          FROM career_job_applications
          WHERE career_job_applications.id = shortlisted_final_checklists.application_id
            AND career_job_applications.applicant_id IS NOT NULL
        )
    `).run();
  });

  transaction();
};

backfillApplicantIdentityLinks();

const normalizeOfferStatus = (value, fallback = null) => {
  const normalized = cleanText(value).toLowerCase();
  return OFFER_STATUSES.has(normalized) ? normalized : fallback;
};

const parseOfferHistory = (value) => {
  const parsed = parseJson(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(Boolean).map((entry) => ({
    status: normalizeOfferStatus(entry.status),
    at: cleanText(entry.at),
    reason: cleanText(entry.reason) || "",
    applicationStatus: cleanText(entry.applicationStatus).toLowerCase() || ""
  })).filter((entry) => entry.status && entry.at);
};

const deriveOfferStatusFromRow = (row) => {
  const explicit = normalizeOfferStatus(row?.offer_status);
  if (explicit) return explicit;
  const applicationStatus = cleanText(row?.status).toLowerCase();
  if (applicationStatus === "offer") return "pending";
  if (applicationStatus === "hired") return "closed";
  return null;
};

const buildOfferStatusPatch = (row, requestedStatus, options = {}) => {
  const nextStatus = normalizeOfferStatus(requestedStatus);
  if (!nextStatus) {
    throw new Error("Invalid offer status.");
  }

  const timestamp = cleanText(options.timestamp) || nowIso();
  const reason = cleanText(options.reason);
  const applicationStatus = cleanText(options.applicationStatus ?? row?.status).toLowerCase() || "new";
  const history = parseOfferHistory(row?.offer_history_json);
  const lastEntry = history[history.length - 1];
  const shouldAppend = !lastEntry
    || lastEntry.status !== nextStatus
    || lastEntry.reason !== reason
    || lastEntry.applicationStatus !== applicationStatus;

  if (shouldAppend) {
    history.push({
      status: nextStatus,
      at: timestamp,
      reason,
      applicationStatus
    });
  }

  return {
    offer_status: nextStatus,
    offer_status_updated_at: timestamp,
    offer_closed_at: nextStatus === "closed" ? timestamp : null,
    offer_deleted_at: nextStatus === "deleted" ? timestamp : null,
    offer_history_json: JSON.stringify(history)
  };
};

const seedOfferTrackingHistory = () => {
  const rows = db.prepare(`
    SELECT *
    FROM career_job_applications
    WHERE offer_status IS NOT NULL
       OR lower(status) IN ('offer', 'hired')
  `).all();

  for (const row of rows) {
    const derivedStatus = deriveOfferStatusFromRow(row);
    if (!derivedStatus) continue;

    const history = parseOfferHistory(row.offer_history_json);
    if (normalizeOfferStatus(row.offer_status) && history.length > 0) {
      continue;
    }

    const timestamp = row.offer_status_updated_at || row.updated_at || row.created_at || nowIso();
    const patch = buildOfferStatusPatch(row, derivedStatus, {
      timestamp,
      reason: history.length ? "" : "Offer tracking initialized",
      applicationStatus: row.status
    });

    db.prepare(`
      UPDATE career_job_applications
      SET offer_status = ?,
          offer_status_updated_at = ?,
          offer_closed_at = ?,
          offer_deleted_at = ?,
          offer_history_json = ?
      WHERE id = ?
    `).run(
      patch.offer_status,
      patch.offer_status_updated_at,
      patch.offer_closed_at,
      patch.offer_deleted_at,
      patch.offer_history_json,
      row.id
    );
  }
};

seedOfferTrackingHistory();

const safeName = (value) => cleanText(value)
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "") || "file";

const codeFor = (prefix) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const token = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${stamp}-${token}`;
};

const referenceForPosting = () => {
  const year = new Date().getFullYear();
  const row = db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM career_job_postings").get();
  const nextNumber = String((row?.max_id || 0) + 1).padStart(3, "0");
  return `TC-${year}-${nextNumber}`;
};

const isMimeMatch = (mimeType, prefixes) => prefixes
  .some((prefix) => mimeType === prefix || mimeType.startsWith(`${prefix};`));

const getUploadRules = (fieldName = "") => {
  if (fieldName === "id-photo" || fieldName === "company-logo" || fieldName === "cover-photo") {
    return {
      extensions: imageUploadExtensions,
      mimePrefixes: imageUploadMimePrefixes,
      label: "JPG, PNG, WEBP, HEIC, or HEIF image files"
    };
  }

  return {
    extensions: documentUploadExtensions,
    mimePrefixes: documentUploadMimePrefixes,
    label: "PDF, DOC, DOCX, RTF, or TXT files"
  };
};

const hasExpectedFileSignature = (extension, buffer) => {
  if (!buffer?.length) return false;

  switch (extension) {
    case ".pdf":
      return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
    case ".png":
      return buffer.length >= 8
        && buffer[0] === 0x89
        && buffer.subarray(1, 4).toString("ascii") === "PNG"
        && buffer[4] === 0x0d
        && buffer[5] === 0x0a
        && buffer[6] === 0x1a
        && buffer[7] === 0x0a;
    case ".jpg":
    case ".jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case ".webp":
      return buffer.length >= 12
        && buffer.subarray(0, 4).toString("ascii") === "RIFF"
        && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    case ".heic":
    case ".heif":
      return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case ".docx":
      return buffer[0] === 0x50 && buffer[1] === 0x4b;
    case ".doc":
      return buffer.length >= 8
        && buffer[0] === 0xd0
        && buffer[1] === 0xcf
        && buffer[2] === 0x11
        && buffer[3] === 0xe0
        && buffer[4] === 0xa1
        && buffer[5] === 0xb1
        && buffer[6] === 0x1a
        && buffer[7] === 0xe1;
    case ".rtf":
      return buffer.subarray(0, 5).toString("ascii") === "{\\rtf";
    case ".txt":
      return true;
    default:
      return false;
  }
};

const ensureAllowedUpload = (upload, fieldName = "") => {
  if (!upload || !upload.name || !upload.contentBase64) {
    throw new Error("A valid upload is required.");
  }

  const extension = path.extname(String(upload.name)).toLowerCase();
  const rules = getUploadRules(fieldName);
  if (!rules.extensions.has(extension)) {
    throw new Error(`Unsupported file type. Please upload ${rules.label}.`);
  }

  const buffer = Buffer.from(String(upload.contentBase64), "base64");
  if (!buffer.length) {
    throw new Error("Uploaded file is empty.");
  }

  const mimeType = cleanText(upload.type || "application/octet-stream").toLowerCase();
  const hasAllowedMime = isMimeMatch(mimeType, rules.mimePrefixes);
  const hasValidSignature = hasExpectedFileSignature(extension, buffer);
  if (!hasAllowedMime && !hasValidSignature) {
    throw new Error(`Unsupported upload format. Please upload ${rules.label}.`);
  }

  if (buffer.length > maxUploadBytes) {
    throw new Error(`Each upload must be ${Math.round(maxUploadBytes / (1024 * 1024))}MB or smaller.`);
  }

  return {
    originalName: safeName(upload.name),
    mimeType,
    buffer,
    sizeBytes: buffer.length,
    extension
  };
};

const saveCareerFile = ({ ownerType, ownerId, fieldName, upload }) => {
  const { originalName, mimeType, buffer, sizeBytes, extension } = ensureAllowedUpload(upload, fieldName);
  const folder = path.join(uploadsRoot, ownerType, String(ownerId));
  fs.mkdirSync(folder, { recursive: true });

  const storedName = `${fieldName}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`;
  const absolutePath = path.join(folder, storedName);
  fs.writeFileSync(absolutePath, buffer);

  const relativePath = path.relative(uploadsRoot, absolutePath).replace(/\\/g, "/");
  const result = db.prepare(`
    INSERT INTO career_files
    (owner_type, owner_id, field_name, original_name, stored_name, mime_type, size_bytes, relative_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ownerType, ownerId, fieldName, originalName, storedName, mimeType, sizeBytes, relativePath);

  return Number(result.lastInsertRowid);
};

const getCareerFileById = (id) => {
  const row = db.prepare("SELECT * FROM career_files WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    absolutePath: path.join(uploadsRoot, row.relative_path)
  };
};

const mapFileRowToMeta = (row) => row ? {
  id: row.id,
  name: row.original_name,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  downloadUrl: `/api/admin/careers/files/${row.id}/download`
} : null;

const getFileMetaMap = (fileIds = []) => {
  const ids = [...new Set((Array.isArray(fileIds) ? fileIds : []).map((value) => toInt(value)).filter(Boolean))];
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db.prepare(`
    SELECT *
    FROM career_files
    WHERE id IN (${placeholders})
  `).all(...ids);
  return new Map(rows.map((row) => [row.id, mapFileRowToMeta(row)]));
};

const fileMeta = (fileId) => {
  if (!fileId) return null;
  const row = db.prepare("SELECT * FROM career_files WHERE id = ?").get(fileId);
  return mapFileRowToMeta(row);
};

const removeFileIfPresent = (absolutePath) => {
  if (!absolutePath) return;
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.warn(`Unable to remove careers file ${absolutePath}:`, error?.message || error);
  }
};

const pruneEmptyDirectories = (startDir, stopDir) => {
  let currentDir = startDir;
  const stopAt = path.resolve(stopDir);
  while (currentDir && path.resolve(currentDir).startsWith(stopAt) && path.resolve(currentDir) !== stopAt) {
    try {
      if (!fs.existsSync(currentDir) || fs.readdirSync(currentDir).length > 0) {
        break;
      }
      fs.rmdirSync(currentDir);
      currentDir = path.dirname(currentDir);
    } catch {
      break;
    }
  }
};

const deleteCareerFileRecord = (fileId) => {
  const file = getCareerFileById(fileId);
  if (!file) return;
  removeFileIfPresent(file.absolutePath);
  db.prepare("DELETE FROM career_files WHERE id = ?").run(fileId);
  pruneEmptyDirectories(path.dirname(file.absolutePath), uploadsRoot);
};

const deleteApplicationRecord = (id) => {
  const row = db.prepare("SELECT * FROM career_job_applications WHERE id = ?").get(id);
  if (!row) return null;
  const current = getAdminApplication(id);

  if (row.cv_file_id) deleteCareerFileRecord(row.cv_file_id);
  if (row.cover_letter_file_id) deleteCareerFileRecord(row.cover_letter_file_id);
  if (row.id_photo_file_id) deleteCareerFileRecord(row.id_photo_file_id);
  // Also remove any extra files stored in career_files for this application
  const extraFiles = db.prepare("SELECT id FROM career_files WHERE owner_type = 'job-application' AND owner_id = ?").all(id);
  for (const f of extraFiles) deleteCareerFileRecord(f.id);
  db.prepare("DELETE FROM career_screening_applicants WHERE application_id = ?").run(id);
  db.prepare("DELETE FROM shortlisted_applicants WHERE application_id = ?").run(id);
  db.prepare("DELETE FROM shortlisted_final_checklists WHERE application_id = ?").run(id);
  db.prepare("UPDATE career_messages SET linked_application_id = NULL, updated_at = ? WHERE linked_application_id = ?")
    .run(nowIso(), id);
  deleteNotificationsFor("application", id);

  db.prepare("DELETE FROM career_job_applications WHERE id = ?").run(id);
  return current;
};

const notificationStatusFor = (status) => {
  const next = cleanText(status).toLowerCase();
  return ["unread", "read"].includes(next) ? next : "unread";
};

const mapNotificationRow = (row) => row ? ({
  id: String(row.id),
  type: row.type || "dashboard",
  status: row.status || "unread",
  title: row.title || "",
  detail: row.detail || "",
  tone: row.tone || "info",
  relatedType: row.related_type || "",
  relatedId: row.related_id || "",
  createdAt: row.created_at,
  readAt: row.read_at || null,
  updatedAt: row.updated_at
}) : null;

const createDashboardNotification = (data = {}) => {
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO career_notifications (
      type, status, title, detail, tone, related_type, related_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanText(data.type) || "dashboard",
    notificationStatusFor(data.status),
    cleanText(data.title) || "Dashboard notification",
    cleanText(data.detail),
    cleanText(data.tone) || "info",
    cleanText(data.relatedType),
    data.relatedId !== undefined && data.relatedId !== null ? String(data.relatedId) : "",
    data.createdAt || now,
    now
  );
  return getDashboardNotification(Number(result.lastInsertRowid));
};

const getDashboardNotification = (id) => mapNotificationRow(
  db.prepare("SELECT * FROM career_notifications WHERE id = ?").get(id)
);

const listDashboardNotifications = ({ status = "all", limit = 50 } = {}) => {
  const cleanStatus = cleanText(status).toLowerCase();
  const params = [];
  const where = cleanStatus !== "all" ? "WHERE status = ?" : "";
  if (where) params.push(notificationStatusFor(cleanStatus));
  params.push(Math.min(toInt(limit, 50) || 50, 200));
  return db.prepare(`
    SELECT *
    FROM career_notifications
    ${where}
    ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
    LIMIT ?
  `).all(...params).map(mapNotificationRow);
};

const getDashboardNotificationSummary = () => {
  const counts = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) AS unread,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS read
    FROM career_notifications
  `).get();
  return {
    total: Number(counts?.total || 0),
    unread: Number(counts?.unread || 0),
    read: Number(counts?.read || 0)
  };
};

const getUnreadDashboardNotificationCount = () => {
  const row = db.prepare(`
    SELECT COUNT(*) AS unread
    FROM career_notifications
    WHERE status = 'unread'
  `).get();
  return Number(row?.unread || 0);
};

const listRecentDashboardNotifications = ({ limit = 10 } = {}) => {
  return listDashboardNotifications({ limit: Math.min(toInt(limit, 10) || 10, 50) });
};

const getLatestDashboardNotificationTimestamp = () => {
  const row = db.prepare(`
    SELECT COALESCE(updated_at, created_at) AS latest_timestamp
    FROM career_notifications
    ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
    LIMIT 1
  `).get();
  return row?.latest_timestamp || null;
};

const markDashboardNotificationRead = (id) => {
  const current = getDashboardNotification(id);
  if (!current) return null;
  const now = nowIso();
  db.prepare(`
    UPDATE career_notifications
    SET status = 'read', read_at = COALESCE(read_at, ?), updated_at = ?
    WHERE id = ?
  `).run(now, now, id);
  return getDashboardNotification(id);
};

const deleteDashboardNotification = (id) => {
  const current = getDashboardNotification(id);
  if (!current) return null;
  db.prepare("DELETE FROM career_notifications WHERE id = ?").run(id);
  return current;
};

const deleteNotificationsFor = (relatedType, relatedId) => {
  db.prepare("DELETE FROM career_notifications WHERE related_type = ? AND related_id = ?")
    .run(cleanText(relatedType), String(relatedId));
};

const getScreeningRowByPositionId = (positionId) => db.prepare(`
  SELECT *
  FROM career_screenings
  WHERE job_posting_id = ?
`).get(positionId);

const getScreeningApplicantRowByApplicationId = (applicationId) => db.prepare(`
  SELECT sa.*
  FROM career_screening_applicants sa
  JOIN career_screenings s ON s.id = sa.screening_id
  WHERE sa.application_id = ?
`).get(applicationId);

const calculateScreeningMetrics = (scores = {}, criteria = []) => {
  const criteriaList = Array.isArray(criteria) ? criteria : [];
  const normalizedScores = scores && typeof scores === "object" ? scores : {};
  let weightedTotal = 0;
  let weightedMax = 0;
  let requiredCount = 0;
  let requiredScored = 0;
  let scoredCount = 0;

  criteriaList.forEach((criterion) => {
    const criterionId = String(criterion.id || "");
    if (!criterionId) return;
    const maxPoints = Math.min(Math.max(toInt(criterion.maxPoints, 10) || 10, 1), 20);
    const weight = Math.min(Math.max(toInt(criterion.weight, 1) || 1, 1), 5);
    const item = normalizedScores[criterionId] || {};
    const value = item.score === "" || item.score === null || item.score === undefined ? null : Number(item.score);
    const hasScore = Number.isFinite(value);

    weightedMax += maxPoints * weight;
    if (criterion.required) requiredCount += 1;
    if (hasScore) {
      const clamped = Math.min(Math.max(value, 0), maxPoints);
      weightedTotal += clamped * weight;
      scoredCount += 1;
      if (criterion.required) requiredScored += 1;
    }
  });

  const percent = weightedMax > 0
    ? Math.round((weightedTotal / weightedMax) * 1000) / 10
    : 0;

  return {
    weightedTotal: Math.round(weightedTotal * 10) / 10,
    weightedMax,
    screeningScore: percent,
    scoredCount,
    criteriaCount: criteriaList.length,
    requiredCount,
    requiredScored,
    complete: criteriaList.length > 0 && scoredCount === criteriaList.length,
    requiredComplete: requiredCount === 0 ? criteriaList.length > 0 && scoredCount === criteriaList.length : requiredScored === requiredCount
  };
};

const buildScreeningScoreSheet = (scores = {}, criteria = []) => {
  const criteriaList = Array.isArray(criteria) ? criteria : [];
  const normalizedScores = scores && typeof scores === "object" ? scores : {};
  const rows = criteriaList.map((criterion, index) => {
    const criterionId = String(criterion.id || `criterion-${index}`);
    const maxPoints = Math.min(Math.max(toInt(criterion.maxPoints, 10) || 10, 1), 20);
    const weight = Math.min(Math.max(toInt(criterion.weight, 1) || 1, 1), 5);
    const item = normalizedScores[criterionId] || {};
    const rawScore = item.score === "" || item.score === null || item.score === undefined ? null : Number(item.score);
    const hasScore = Number.isFinite(rawScore);
    const score = hasScore ? Math.min(Math.max(rawScore, 0), maxPoints) : null;
    const weightedScore = hasScore ? roundScore(score * weight, 2) : 0;
    const weightedMax = roundScore(maxPoints * weight, 2);

    return {
      criterionId,
      name: cleanText(criterion.name) || `Criterion ${index + 1}`,
      description: cleanText(criterion.description),
      required: Boolean(criterion.required),
      maxPoints,
      weight,
      score,
      weightedScore,
      weightedMax,
      complete: hasScore
    };
  });

  const totals = rows.reduce((accumulator, row) => ({
    weightedScore: accumulator.weightedScore + row.weightedScore,
    weightedMax: accumulator.weightedMax + row.weightedMax,
    completeCount: accumulator.completeCount + (row.complete ? 1 : 0),
    requiredCount: accumulator.requiredCount + (row.required ? 1 : 0),
    requiredComplete: accumulator.requiredComplete + (row.required && row.complete ? 1 : 0)
  }), {
    weightedScore: 0,
    weightedMax: 0,
    completeCount: 0,
    requiredCount: 0,
    requiredComplete: 0
  });

  const screeningScore = totals.weightedMax > 0
    ? roundScore((totals.weightedScore / totals.weightedMax) * 100, 1)
    : 0;

  return {
    rows,
    totals: {
      weightedScore: roundScore(totals.weightedScore, 2),
      weightedMax: roundScore(totals.weightedMax, 2),
      screeningScore,
      scoredCount: totals.completeCount,
      criteriaCount: rows.length,
      requiredCount: totals.requiredCount,
      requiredScored: totals.requiredComplete,
      complete: rows.length > 0 && totals.completeCount === rows.length,
      requiredComplete: totals.requiredCount === 0
        ? rows.length > 0 && totals.completeCount === rows.length
        : totals.requiredComplete === totals.requiredCount
    }
  };
};

const buildApplicantRankingSnapshot = ({ application, criteria = [] } = {}) => {
  const scores = application?.screening?.scores || {};
  const scoreSheet = buildScreeningScoreSheet(scores, criteria);
  const screeningScore = Number.isFinite(Number(application?.screening?.screeningScore))
    ? Number(application.screening.screeningScore)
    : scoreSheet.totals.screeningScore;
  const tieBreakerPoints = Number(application?.screening?.tieBreakerPoints || 0);
  const finalScore = Number.isFinite(Number(application?.screening?.finalScore))
    ? Number(application.screening.finalScore)
    : calculateFinalScreeningScore(screeningScore, tieBreakerPoints);

  return {
    ...application,
    screening: {
      ...(application?.screening || {}),
      screeningScore,
      tieBreakerPoints,
      finalScore,
      scoreSheet,
      completeness: {
        scoredCount: scoreSheet.totals.scoredCount,
        criteriaCount: scoreSheet.totals.criteriaCount,
        requiredCount: scoreSheet.totals.requiredCount,
        requiredScored: scoreSheet.totals.requiredScored,
        complete: scoreSheet.totals.complete,
        requiredComplete: scoreSheet.totals.requiredComplete
      }
    },
    screeningReady: scoreSheet.totals.complete,
    screeningIncomplete: !scoreSheet.totals.complete
  };
};

const TIE_BREAKER_MAX_POINTS = 1;
const SCREENING_NEAR_TIE_THRESHOLD = 0.5;

const roundScore = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
};

const validateTieBreakerPoints = (value) => {
  const next = value === "" || value === null || value === undefined ? 0 : Number(value);
  if (!Number.isFinite(next)) throw new Error("Tie-breaker score must be numeric.");
  if (next < 0 || next > TIE_BREAKER_MAX_POINTS) {
    throw new Error("Tie-breaker score must be between 0.0 and 1.0.");
  }
  return roundScore(next, 2);
};

const calculateFinalScreeningScore = (screeningScore, tieBreakerPoints = 0) => (
  roundScore(Number(screeningScore || 0) + validateTieBreakerPoints(tieBreakerPoints), 2)
);

const sortScreeningApplicantsByScore = (applicants = [], direction = "desc", field = "screeningScore") => (
  [...applicants].sort((left, right) => {
    const leftScore = Number(left?.screening?.[field] ?? 0);
    const rightScore = Number(right?.screening?.[field] ?? 0);
    if (leftScore !== rightScore) {
      return direction === "asc" ? leftScore - rightScore : rightScore - leftScore;
    }
    const leftName = cleanText(left?.name).toLowerCase();
    const rightName = cleanText(right?.name).toLowerCase();
    if (leftName !== rightName) return leftName.localeCompare(rightName);
    return Number(left?.id || 0) - Number(right?.id || 0);
  })
);

const detectScreeningTieGroups = (applicants = [], threshold = SCREENING_NEAR_TIE_THRESHOLD) => {
  const exactGroups = new Map();
  applicants.forEach((application) => {
    const screeningScore = Number(application?.screening?.screeningScore);
    if (!Number.isFinite(screeningScore)) return;
    const key = screeningScore.toFixed(1);
    if (!exactGroups.has(key)) exactGroups.set(key, []);
    exactGroups.get(key).push(application);
  });

  const tieGroups = [];
  exactGroups.forEach((members, scoreKey) => {
    if (members.length < 2) return;
    tieGroups.push({
      id: `tie-${scoreKey.replace(".", "-")}`,
      screeningScore: Number(scoreKey),
      scoreRange: 0,
      reason: "exact",
      applicationIds: members.map((item) => String(item.id)),
      reviewed: members.every((item) => Boolean(item?.screening?.tieBreakerReviewed))
    });
  });

  const nearTieGroups = [];
  const sorted = sortScreeningApplicantsByScore(applicants, "desc", "screeningScore");
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    const currentScore = Number(current?.screening?.screeningScore);
    const nextScore = Number(next?.screening?.screeningScore);
    if (!Number.isFinite(currentScore) || !Number.isFinite(nextScore)) continue;
    const delta = roundScore(Math.abs(currentScore - nextScore), 2);
    if (delta === 0 || delta > threshold) continue;
    const applicationIds = [String(current.id), String(next.id)].sort();
    if (tieGroups.some((group) => group.applicationIds.every((id) => applicationIds.includes(id)))) continue;
    if (nearTieGroups.some((group) => group.applicationIds.join(",") === applicationIds.join(","))) continue;
    nearTieGroups.push({
      id: `near-${applicationIds.join("-")}`,
      screeningScore: Math.max(currentScore, nextScore),
      scoreRange: delta,
      reason: "near",
      applicationIds,
      reviewed: applicationIds.every((id) => Boolean(applicants.find((item) => String(item.id) === id)?.screening?.tieBreakerReviewed))
    });
  }

  return {
    tieGroups,
    nearTieGroups,
    candidateGroups: [...tieGroups, ...nearTieGroups]
  };
};

const listTieBreakerCriteria = (positionId = null) => {
  const rows = positionId
    ? db.prepare(`
      SELECT *
      FROM career_screening_tie_breaker_criteria
      WHERE job_posting_id = ?
      ORDER BY datetime(updated_at) DESC, id DESC
    `).all(toInt(positionId))
    : db.prepare(`
      SELECT *
      FROM career_screening_tie_breaker_criteria
      ORDER BY datetime(updated_at) DESC, id DESC
    `).all();
  return rows.map((row) => ({
    id: String(row.id),
    positionId: String(row.job_posting_id),
    screeningId: row.screening_id === null || row.screening_id === undefined ? null : String(row.screening_id),
    screeningRunId: row.screening_run_id || "",
    criteriaType: cleanText(row.criteria_type) || "tie_breaker",
    name: row.criteria_name,
    description: row.criteria_description || "",
    maxPoints: Number.isFinite(Number(row.max_points)) ? Number(row.max_points) : TIE_BREAKER_MAX_POINTS,
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const mapScreeningForPosition = (positionId) => {
  const row = getScreeningRowByPositionId(positionId);
  if (!row) return null;
  return {
    id: String(row.id),
    criteria: parseJson(row.criteria_json, []),
    rankings: parseJson(row.rankings_json, []).map((id) => String(id)),
    pushedAt: row.pushed_at || null,
    lastSortedAt: row.last_sorted_at || null,
    lastSortedBy: row.last_sorted_by || "",
    lastSortDirection: row.last_sort_direction || "",
    tieBreakerEnabled: Boolean(row.tie_breaker_enabled),
    rankingNeedsRefresh: Boolean(row.ranking_needs_refresh),
    tieBreakerCriteria: listTieBreakerCriteria(positionId),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapScreeningForApplicant = (applicationId) => {
  const row = getScreeningApplicantRowByApplicationId(applicationId);
  if (!row) return null;
  const scores = parseJson(row.scores_json, {});
  const screeningRow = row.screening_id ? db.prepare("SELECT criteria_json FROM career_screenings WHERE id = ?").get(row.screening_id) : null;
  const criteria = parseJson(screeningRow?.criteria_json, []);
  const metrics = calculateScreeningMetrics(scores, criteria);
  const tieBreakerPoints = Number(row.tie_breaker_points || 0);
  const finalScore = Number.isFinite(Number(row.final_score)) ? Number(row.final_score) : metrics.screeningScore + tieBreakerPoints;
  return {
    id: String(row.id),
    status: cleanText(row.screening_status) || "not-started",
    scores,
    ai: parseJson(row.ai_json, null),
    report: parseJson(row.report_json, { content: "", recommendation: "" }),
    screeningScore: Number.isFinite(Number(row.screening_score)) ? Number(row.screening_score) : metrics.screeningScore,
    tieBreakerCriteriaId: row.tie_breaker_criteria_id === null || row.tie_breaker_criteria_id === undefined ? "" : String(row.tie_breaker_criteria_id),
    tieBreakerPoints,
    finalScore,
    tieBreakerReviewed: Boolean(row.tie_breaker_reviewed),
    sortOrder: row.sort_order === null || row.sort_order === undefined ? null : Number(row.sort_order),
    shortlistDecision: cleanText(row.shortlist_decision).toLowerCase() || "",
    shortlistDecidedAt: row.shortlist_decided_at || null,
    shortlistDecidedBy: row.shortlist_decided_by || "",
    completeness: {
      scoredCount: metrics.scoredCount,
      criteriaCount: metrics.criteriaCount,
      requiredCount: metrics.requiredCount,
      requiredScored: metrics.requiredScored,
      complete: metrics.complete,
      requiredComplete: metrics.requiredComplete
    },
    savedAt: row.saved_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapScreeningFromApplicationRow = (row) => {
  if (!row?.screening_applicant_id) return null;
  const scores = parseJson(row.screening_scores_json, {});
  return {
    id: String(row.screening_applicant_id),
    status: cleanText(row.screening_status) || "not-started",
    scores,
    ai: parseJson(row.screening_ai_json, null),
    report: parseJson(row.screening_report_json, { content: "", recommendation: "" }),
    screeningScore: Number.isFinite(Number(row.screening_score_value)) ? Number(row.screening_score_value) : null,
    tieBreakerCriteriaId: row.screening_tie_breaker_criteria_id === null || row.screening_tie_breaker_criteria_id === undefined ? "" : String(row.screening_tie_breaker_criteria_id),
    tieBreakerPoints: Number(row.screening_tie_breaker_points || 0),
    finalScore: Number.isFinite(Number(row.screening_final_score)) ? Number(row.screening_final_score) : null,
    tieBreakerReviewed: Boolean(row.screening_tie_breaker_reviewed),
    sortOrder: row.screening_sort_order === null || row.screening_sort_order === undefined ? null : Number(row.screening_sort_order),
    shortlistDecision: cleanText(row.screening_shortlist_decision).toLowerCase() || "",
    shortlistDecidedAt: row.screening_shortlist_decided_at || null,
    shortlistDecidedBy: row.screening_shortlist_decided_by || "",
    savedAt: row.screening_saved_at || null,
    createdAt: row.screening_created_at,
    updatedAt: row.screening_updated_at
  };
};

const mapPostingRow = (row) => ({
  id: String(row.id),
  ref: row.reference_code,
  title: row.title,
  company: row.company_name || "Confidential Client",
  client: row.company_name || "",
  department: row.department || "",
  industry: row.industry || "",
  location: row.location || "",
  type: row.employment_type || "",
  employmentType: row.employment_type || "",
  numHires: row.number_of_vacancies || 1,
  salary: row.salary_display || "Salary discussed with shortlisted candidates",
  salaryRange: row.salary_display || "",
  level: row.level || "Mid-level",
  startDate: row.start_date || "",
  closing: row.closing_date || "Open until filled",
  closingDate: row.closing_date || "",
  description: row.description || "",
  desc: row.description || "Role details will be shared during the application process.",
  responsibilities: row.responsibilities || "",
  requirements: row.requirements || "",
  contactPerson: row.contact_person || "",
  reasonForHiring: row.reason_for_hiring || "",
  status: row.status,
  coverLetterRequired: Boolean(row.cover_letter_required),
  featured: Boolean(row.featured),
  urgent: Boolean(row.urgent),
  applied: Boolean(row.applied),
  approved: Boolean(row.approved),
  approvedAt: row.approved_at || null,
  publishedAt: row.published_at || null,
  closedAt: row.closed_at || null,
  sourceSubmissionId: row.source_submission_id ? String(row.source_submission_id) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  posted: row.published_at ? new Date(row.published_at).toLocaleDateString("en-PG") : "Pending publication",
  applicants: row.applicant_count || 0,
  companyDescription: row.company_description || "",
  companyLogoFileId: row.company_logo_file_id || null,
  coverPhotoFileId: row.cover_photo_file_id || null,
  pipedriveOrgId: row.pipedrive_org_id || null,
  pipedriveDealId: row.pipedrive_deal_id || null,
  companyLogoUrl: row.company_logo_file_id ? `/api/careers/image/${row.company_logo_file_id}` : null,
  coverPhotoUrl: row.cover_photo_file_id ? `/api/careers/image/${row.cover_photo_file_id}` : null,
  externalLinks: parseJson(row.external_links, []).map((link) => ({
    ...link,
    url: externalHref(link?.url)
  })).filter((link) => link.url),
  checklist: parseJson(row.checklist_json, {}),
  screening: mapScreeningForPosition(row.id),
  filtration: parseJson(row.filtration_json, null),
  externalApplyUrl: externalHref(row.external_apply_url) || null
});

const listJobPostingRows = (whereClause = "", params = []) => db.prepare(`
  SELECT
    p.*,
    COUNT(a.id) AS applicant_count
  FROM career_job_postings p
  LEFT JOIN career_job_applications a ON a.job_posting_id = p.id
  ${whereClause}
  GROUP BY p.id
  ORDER BY
    CASE p.status
      WHEN 'published' THEN 1
      WHEN 'ready' THEN 2
      WHEN 'draft' THEN 3
      WHEN 'closed' THEN 4
      ELSE 5
    END,
    COALESCE(p.published_at, p.updated_at, p.created_at) DESC
`).all(...params);

const getJobPosting = (id) => {
  const row = listJobPostingRows("WHERE p.id = ?", [id])[0];
  return row ? mapPostingRow(row) : null;
};

const createJobPosting = (data = {}) => {
  const now = nowIso();
  const status = cleanText(data.status) || "draft";
  const approved = Boolean(data.approved || status === "ready" || status === "published");
  const publishedAt = status === "published" ? (data.publishedAt || now) : null;
  const closedAt = status === "closed" ? (data.closedAt || now) : null;
  const result = db.prepare(`
    INSERT INTO career_job_postings (
      reference_code, title, company_name, company_description, department, industry, location, employment_type,
      number_of_vacancies, salary_display, level, start_date, closing_date, description, responsibilities,
      requirements, contact_person, reason_for_hiring, cover_letter_required, featured, urgent, applied,
      approved, status, checklist_json, source_submission_id, approved_at, published_at, closed_at,
      external_apply_url, company_logo_file_id, cover_photo_file_id, external_links, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    referenceForPosting(),
    cleanText(data.title),
    cleanText(data.client || data.company || data.companyName),
    cleanMultiline(data.companyDescription || data.aboutCompany),
    cleanText(data.department),
    cleanText(data.industry),
    cleanText(data.location),
    cleanText(data.employmentType || data.type),
    toInt(data.numHires || data.numberOfVacancies, 1),
    cleanText(data.salaryRange || data.salaryDisplay || data.salary),
    cleanText(data.level),
    cleanText(data.startDate),
    cleanText(data.closingDate || data.closing),
    cleanMultiline(data.description),
    cleanMultiline(data.responsibilities),
    cleanMultiline(data.requirements),
    cleanText(data.contactPerson),
    cleanText(data.reasonForHiring),
    boolInt(data.coverLetterRequired),
    boolInt(data.featured),
    boolInt(data.urgent),
    boolInt(data.applied),
    boolInt(approved),
    status,
    JSON.stringify(data.checklist || {}),
    toInt(data.sourceSubmissionId),
    approved ? (data.approvedAt || now) : null,
    publishedAt,
    closedAt,
    cleanText(data.externalApplyUrl) || null,
    toInt(data.companyLogoFileId),
    toInt(data.coverPhotoFileId),
    JSON.stringify(Array.isArray(data.externalLinks) ? data.externalLinks.filter(l => l?.url) : []),
    now,
    now
  );

  return getJobPosting(Number(result.lastInsertRowid));
};

const updateJobPosting = (id, data = {}) => {
  const current = db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(id);
  if (!current) return null;

  const next = {
    ...current,
    title: cleanText(data.title ?? current.title),
    company_name: cleanText(data.client ?? data.company ?? data.companyName ?? current.company_name),
    company_description: cleanMultiline(data.companyDescription ?? data.aboutCompany ?? current.company_description),
    department: cleanText(data.department ?? current.department),
    industry: cleanText(data.industry ?? current.industry),
    location: cleanText(data.location ?? current.location),
    employment_type: cleanText(data.employmentType ?? data.type ?? current.employment_type),
    number_of_vacancies: toInt(data.numHires ?? data.numberOfVacancies ?? current.number_of_vacancies, current.number_of_vacancies || 1),
    salary_display: cleanText(data.salaryRange ?? data.salaryDisplay ?? data.salary ?? current.salary_display),
    level: cleanText(data.level ?? current.level),
    start_date: cleanText(data.startDate ?? current.start_date),
    closing_date: cleanText(data.closingDate ?? data.closing ?? current.closing_date),
    description: cleanMultiline(data.description ?? current.description),
    responsibilities: cleanMultiline(data.responsibilities ?? current.responsibilities),
    requirements: cleanMultiline(data.requirements ?? current.requirements),
    contact_person: cleanText(data.contactPerson ?? current.contact_person),
    reason_for_hiring: cleanText(data.reasonForHiring ?? current.reason_for_hiring),
    cover_letter_required: boolInt(data.coverLetterRequired ?? current.cover_letter_required),
    featured: boolInt(data.featured ?? current.featured),
    urgent: boolInt(data.urgent ?? current.urgent),
    applied: boolInt(data.applied ?? current.applied),
    approved: boolInt(data.approved ?? current.approved),
    status: cleanText(data.status ?? current.status) || current.status,
    checklist_json: JSON.stringify(data.checklist ?? parseJson(current.checklist_json, {})),
    approved_at: data.approvedAt !== undefined ? data.approvedAt : current.approved_at,
    published_at: data.publishedAt !== undefined ? data.publishedAt : current.published_at,
    closed_at: data.closedAt !== undefined ? data.closedAt : current.closed_at,
    external_apply_url: data.externalApplyUrl !== undefined
      ? (cleanText(data.externalApplyUrl) || null)
      : (current.external_apply_url || null),
    company_logo_file_id: data.companyLogoFileId !== undefined
      ? (toInt(data.companyLogoFileId) || null)
      : (current.company_logo_file_id || null),
    cover_photo_file_id: data.coverPhotoFileId !== undefined
      ? (toInt(data.coverPhotoFileId) || null)
      : (current.cover_photo_file_id || null),
    external_links: data.externalLinks !== undefined
      ? JSON.stringify(Array.isArray(data.externalLinks) ? data.externalLinks.filter(l => l?.url) : [])
      : (current.external_links || "[]"),
    updated_at: nowIso()
  };

  db.prepare(`
    UPDATE career_job_postings SET
      title = ?, company_name = ?, company_description = ?, department = ?, industry = ?, location = ?,
      employment_type = ?, number_of_vacancies = ?, salary_display = ?, level = ?, start_date = ?,
      closing_date = ?, description = ?, responsibilities = ?, requirements = ?, contact_person = ?,
      reason_for_hiring = ?, cover_letter_required = ?, featured = ?, urgent = ?, applied = ?, approved = ?,
      status = ?, checklist_json = ?, approved_at = ?, published_at = ?, closed_at = ?,
      external_apply_url = ?, company_logo_file_id = ?, cover_photo_file_id = ?, external_links = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.title, next.company_name, next.company_description, next.department, next.industry, next.location,
    next.employment_type, next.number_of_vacancies, next.salary_display, next.level, next.start_date,
    next.closing_date, next.description, next.responsibilities, next.requirements, next.contact_person,
    next.reason_for_hiring, next.cover_letter_required, next.featured, next.urgent, next.applied,
    next.approved, next.status, next.checklist_json, next.approved_at, next.published_at, next.closed_at,
    next.external_apply_url, next.company_logo_file_id, next.cover_photo_file_id, next.external_links, next.updated_at,
    id
  );

  return getJobPosting(id);
};

const setJobPostingImage = (id, fieldName, upload) => {
  const posting = db.prepare("SELECT id FROM career_job_postings WHERE id = ?").get(id);
  if (!posting) throw new Error("Posting not found.");
  const fileId = saveCareerFile({ ownerType: "job-posting", ownerId: id, fieldName, upload });
  const col = fieldName === "company-logo" ? "company_logo_file_id" : "cover_photo_file_id";
  db.prepare(`UPDATE career_job_postings SET ${col} = ?, updated_at = ? WHERE id = ?`).run(fileId, nowIso(), id);
  return { fileId, url: `/api/careers/image/${fileId}` };
};

const getPublicJobImage = (fileId) => {
  const row = db.prepare(`
    SELECT f.* FROM career_files f
    JOIN career_job_postings p ON p.id = f.owner_id
    WHERE f.id = ? AND f.owner_type = 'job-posting'
      AND (f.field_name = 'company-logo' OR f.field_name = 'cover-photo')
  `).get(Number(fileId));
  if (!row) return null;
  return { ...row, absolutePath: path.join(uploadsRoot, row.relative_path) };
};

const setJobPostingStatus = (id, status) => {
  const updates = { status };
  const now = nowIso();
  if (status === "ready") {
    updates.approved = true;
    updates.approvedAt = now;
    updates.closedAt = null;
  }
  if (status === "published") {
    updates.approved = true;
    updates.approvedAt = now;
    updates.publishedAt = now;
    updates.closedAt = null;
  }
  if (status === "closed") {
    updates.closedAt = now;
  }
  if (status === "screening") {
    updates.closedAt = now;
  }
  if (status === "draft") {
    updates.closedAt = null;
  }
  return updateJobPosting(id, updates);
};

const deleteJobPosting = (id) => {
  const current = getJobPosting(id);
  if (!current) return null;
  const transaction = db.transaction((postingId) => {
    const applicationIds = db.prepare("SELECT id FROM career_job_applications WHERE job_posting_id = ?").all(postingId);
    for (const application of applicationIds) {
      deleteApplicationRecord(application.id);
    }

    const screeningId = db.prepare("SELECT id FROM career_screenings WHERE job_posting_id = ?").get(postingId)?.id;
    if (screeningId) {
      db.prepare("DELETE FROM career_screening_applicants WHERE screening_id = ?").run(screeningId);
    }
    db.prepare("DELETE FROM career_screenings WHERE job_posting_id = ?").run(postingId);

    db.prepare(`
      UPDATE career_employer_submissions
      SET linked_job_posting_id = NULL,
          status = CASE WHEN status = 'converted' THEN 'new' ELSE status END,
          updated_at = ?
      WHERE linked_job_posting_id = ?
    `).run(nowIso(), postingId);

    db.prepare("DELETE FROM shortlisted_applicants WHERE position_id = ?").run(postingId);
    db.prepare("DELETE FROM shortlisted_final_checklists WHERE position_id = ?").run(postingId);
    db.prepare("DELETE FROM shortlisting_criteria WHERE position_id = ?").run(postingId);
    db.prepare("DELETE FROM career_screening_tie_breaker_criteria WHERE job_posting_id = ?").run(postingId);
    deleteNotificationsFor("job-posting", postingId);
    db.prepare("DELETE FROM career_job_postings WHERE id = ?").run(postingId);
  });

  transaction(id);
  return current;
};

const createEmployerSubmission = (data = {}) => {
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO career_employer_submissions (
      submission_code, full_name, company_name, job_title, industry, number_of_vacancies, location,
      employment_type, phone, email, package_interest, salary_display, message,
      company_address, contact_person_role, job_category, application_deadline, job_description,
      job_criteria, minimum_qualifications, required_experience, required_skills,
      application_instructions, application_instructions_file_id,
      supporting_notes, additional_message, career_site_url, status,
      source_path, ip_address, user_agent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)
  `).run(
    codeFor("EMP"),
    cleanText(data.fullName),
    cleanText(data.companyName),
    cleanText(data.jobTitle),
    cleanText(data.industry),
    toInt(data.numberOfVacancies),
    cleanText(data.location),
    cleanText(data.employmentType),
    cleanText(data.phone),
    cleanText(data.email).toLowerCase(),
    cleanText(data.packageInterest),
    cleanText(data.salaryDisplay),
    cleanMultiline(data.message),
    cleanMultiline(data.companyAddress),
    cleanText(data.contactPersonRole),
    cleanText(data.jobCategory),
    cleanText(data.applicationDeadline),
    cleanMultiline(data.jobDescription),
    cleanMultiline(data.jobCriteria),
    cleanMultiline(data.minimumQualifications),
    cleanMultiline(data.requiredExperience),
    cleanText(data.requiredSkills),
    cleanMultiline(data.applicationInstructions),
    null,
    cleanMultiline(data.supportingNotes),
    cleanMultiline(data.additionalMessage),
    cleanText(data.careerSiteUrl) || null,
    cleanText(data.sourcePath),
    cleanText(data.ipAddress),
    cleanText(data.userAgent),
    now,
    now
  );

  const submissionId = Number(result.lastInsertRowid);
  let appInstrFileId = null;
  if (data.applicationInstructionsUpload) {
    appInstrFileId = saveCareerFile({ ownerType: "employer-submission", ownerId: submissionId, fieldName: "application-instructions", upload: data.applicationInstructionsUpload });
  }
  if (appInstrFileId) {
    db.prepare(`UPDATE career_employer_submissions SET application_instructions_file_id = ?, updated_at = ? WHERE id = ?`).run(appInstrFileId, nowIso(), submissionId);
  }

  const submission = db.prepare("SELECT * FROM career_employer_submissions WHERE id = ?").get(submissionId);
  createDashboardNotification({
    type: "employer-submission",
    title: "Employer request received",
    detail: `${submission.company_name} requested support for ${submission.job_title}.`,
    tone: "urgent",
    relatedType: "employer-submission",
    relatedId: submission.id,
    createdAt: submission.created_at
  });
  return { ...submission, appInstrFileName: appInstrFileId ? data.applicationInstructionsUpload?.name : null };
};

const convertEmployerSubmissionToDraft = (id) => {
  const submission = db.prepare("SELECT * FROM career_employer_submissions WHERE id = ?").get(id);
  if (!submission) return null;

  const posting = createJobPosting({
    title: submission.job_title,
    client: submission.company_name,
    industry: submission.industry,
    location: submission.location,
    employmentType: submission.employment_type,
    numHires: submission.number_of_vacancies,
    salaryRange: submission.salary_display,
    department: submission.job_category,
    closingDate: submission.application_deadline,
    description: submission.job_description || submission.message,
    requirements: [
      submission.job_criteria,
      submission.minimum_qualifications,
      submission.required_experience,
      submission.required_skills,
      submission.application_instructions
    ].filter(Boolean).join("\n\n"),
    contactPerson: [submission.full_name, submission.contact_person_role].filter(Boolean).join(" - "),
    applied: true,
    externalApplyUrl: submission.career_site_url,
    sourceSubmissionId: submission.id,
    status: "draft"
  });

  db.prepare(`
    UPDATE career_employer_submissions
    SET status = 'converted', linked_job_posting_id = ?, updated_at = ?
    WHERE id = ?
  `).run(Number(posting.id), nowIso(), id);

  return posting;
};

const createJobApplication = (jobPostingId, data = {}) => {
  const posting = db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(jobPostingId);
  if (!posting || posting.status !== "published") {
    throw new Error("This job is not currently accepting applications.");
  }

  if (data.cvUpload) {
    ensureAllowedUpload(data.cvUpload, "cv");
  }
  if (data.coverLetterUpload) {
    ensureAllowedUpload(data.coverLetterUpload, "cover-letter");
  }
  if (data.idPhotoUpload) {
    ensureAllowedUpload(data.idPhotoUpload, "id-photo");
  }

  const applicant = ensureApplicantIdentity(data);
  const now = nowIso();
  const insert = db.prepare(`
    INSERT INTO career_job_applications (
      application_code, applicant_id, job_posting_id, full_name, normalized_email, email, phone, current_location, years_experience,
      cover_letter_text, status, source_path, ip_address, user_agent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)
  `).run(
    codeFor("APP"),
    Number(applicant.id),
    jobPostingId,
    applicant.fullName,
    applicant.normalizedEmail,
    applicant.email,
    applicant.phone,
    cleanText(data.currentLocation),
    cleanText(data.yearsExperience),
    cleanMultiline(data.message || data.coverLetterText),
    cleanText(data.sourcePath),
    cleanText(data.ipAddress),
    cleanText(data.userAgent),
    now,
    now
  );

  const applicationId = Number(insert.lastInsertRowid);
  let cvFileId = null;
  let coverLetterFileId = null;
  let idPhotoFileId = null;

  if (data.cvUpload) {
    cvFileId = saveCareerFile({ ownerType: "job-application", ownerId: applicationId, fieldName: "cv", upload: data.cvUpload });
  }
  if (data.coverLetterUpload) {
    coverLetterFileId = saveCareerFile({ ownerType: "job-application", ownerId: applicationId, fieldName: "cover-letter", upload: data.coverLetterUpload });
  }
  if (data.idPhotoUpload) {
    idPhotoFileId = saveCareerFile({ ownerType: "job-application", ownerId: applicationId, fieldName: "id-photo", upload: data.idPhotoUpload });
  }

  db.prepare(`
    UPDATE career_job_applications
    SET cv_file_id = ?, cover_letter_file_id = ?, id_photo_file_id = ?, updated_at = ?
    WHERE id = ?
  `).run(cvFileId, coverLetterFileId, idPhotoFileId, nowIso(), applicationId);

  return getAdminApplication(applicationId);
};

/**
 * Admin-only manual applicant creation — no file uploads required,
 * works on any posting regardless of published status.
 */
const createManualApplication = (jobPostingId, data = {}) => {
  const posting = db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(jobPostingId);
  if (!posting) throw new Error("Job posting not found.");

  if (data.cvUpload) {
    ensureAllowedUpload(data.cvUpload, "cv");
  }
  if (data.coverLetterUpload) {
    ensureAllowedUpload(data.coverLetterUpload, "cover-letter");
  }
  if (data.idPhotoUpload) {
    ensureAllowedUpload(data.idPhotoUpload, "id-photo");
  }

  const applicant = ensureApplicantIdentity(data);
  const now = nowIso();
  const insert = db.prepare(`
    INSERT INTO career_job_applications (
      application_code, applicant_id, job_posting_id, full_name, normalized_email, email, phone,
      current_location, years_experience, cover_letter_text,
      status, source_path, ip_address, user_agent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual-entry', NULL, NULL, ?, ?)
  `).run(
    codeFor("APP"),
    Number(applicant.id),
    jobPostingId,
    applicant.fullName,
    applicant.normalizedEmail,
    applicant.email,
    applicant.phone,
    cleanText(data.currentLocation),
    cleanText(data.yearsExperience),
    cleanMultiline(data.notes || data.coverLetterText || data.message),
    cleanText(data.status) || "new",
    now,
    now
  );
  const applicationId = Number(insert.lastInsertRowid);
  let cvFileId = null;
  let coverLetterFileId = null;
  let idPhotoFileId = null;

  if (data.cvUpload) {
    cvFileId = saveCareerFile({ ownerType: "job-application", ownerId: applicationId, fieldName: "cv", upload: data.cvUpload });
  }
  if (data.coverLetterUpload) {
    coverLetterFileId = saveCareerFile({ ownerType: "job-application", ownerId: applicationId, fieldName: "cover-letter", upload: data.coverLetterUpload });
  }
  if (data.idPhotoUpload) {
    idPhotoFileId = saveCareerFile({ ownerType: "job-application", ownerId: applicationId, fieldName: "id-photo", upload: data.idPhotoUpload });
  }

  db.prepare(`
    UPDATE career_job_applications
    SET cv_file_id = ?, cover_letter_file_id = ?, id_photo_file_id = ?, updated_at = ?
    WHERE id = ?
  `).run(cvFileId, coverLetterFileId, idPhotoFileId, nowIso(), applicationId);

  return getAdminApplication(applicationId);
};

const createTalentPoolSubmission = (data = {}) => {
  const applicant = ensureApplicantIdentity(data);
  const now = nowIso();
  const insert = db.prepare(`
    INSERT INTO career_talent_pool_submissions (
      submission_code, applicant_id, full_name, normalized_email, email, phone, current_location, years_experience, desired_roles,
      industries, summary, preferred_work_location, highest_qualification, key_skills, availability,
      cv_link, cover_letter_link, cover_letter_text, additional_notes, status, source_path, ip_address, user_agent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)
  `).run(
    codeFor("TAL"),
    Number(applicant.id),
    applicant.fullName,
    applicant.normalizedEmail,
    applicant.email,
    applicant.phone,
    cleanText(data.currentLocation),
    cleanText(data.yearsExperience),
    cleanText(data.desiredRoles),
    cleanText(data.industries),
    cleanMultiline(data.message || data.summary),
    cleanText(data.preferredWorkLocation),
    cleanText(data.highestQualification),
    cleanText(data.keySkills),
    cleanText(data.availability),
    null,
    null,
    cleanMultiline(data.coverLetterText),
    cleanMultiline(data.additionalNotes),
    cleanText(data.sourcePath),
    cleanText(data.ipAddress),
    cleanText(data.userAgent),
    now,
    now
  );

  const submissionId = Number(insert.lastInsertRowid);
  let cvFileId = null;
  let coverLetterFileId = null;
  if (data.cvUpload) {
    cvFileId = saveCareerFile({ ownerType: "talent-pool", ownerId: submissionId, fieldName: "cv", upload: data.cvUpload });
  }
  if (data.coverLetterUpload) {
    coverLetterFileId = saveCareerFile({ ownerType: "talent-pool", ownerId: submissionId, fieldName: "cover-letter", upload: data.coverLetterUpload });
  }

  db.prepare(`
    UPDATE career_talent_pool_submissions
    SET cv_file_id = ?, cover_letter_file_id = ?, updated_at = ?
    WHERE id = ?
  `).run(cvFileId, coverLetterFileId, nowIso(), submissionId);

  return getAdminTalentPoolEntry(submissionId);
};

const mapEmployerSubmissionRow = (row) => ({
  id: String(row.id),
  code: row.submission_code,
  fullName: row.full_name,
  companyName: row.company_name,
  jobTitle: row.job_title,
  industry: row.industry || "",
  numberOfVacancies: row.number_of_vacancies || "",
  location: row.location || "",
  employmentType: row.employment_type || "",
  phone: row.phone || "",
  email: row.email,
  packageInterest: row.package_interest || "",
  salaryDisplay: row.salary_display || "",
  message: row.message || "",
  companyAddress: row.company_address || "",
  contactPersonRole: row.contact_person_role || "",
  jobCategory: row.job_category || "",
  applicationDeadline: row.application_deadline || "",
  jobDescription: row.job_description || "",
  jobCriteria: row.job_criteria || "",
  minimumQualifications: row.minimum_qualifications || "",
  requiredExperience: row.required_experience || "",
  requiredSkills: row.required_skills || "",
  applicationInstructions: row.application_instructions || "",
  careerSiteUrl: row.career_site_url || "",
  supportingNotes: row.supporting_notes || "",
  additionalMessage: row.additional_message || "",
  status: row.status,
  linkedJobPostingId: row.linked_job_posting_id ? String(row.linked_job_posting_id) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const listEmployerSubmissions = ({ limit = null } = {}) => db.prepare(`
  SELECT *
  FROM career_employer_submissions
  ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
  ${Number.isInteger(limit) && limit > 0 ? `LIMIT ${Math.min(limit, 500)}` : ""}
`).all().map(mapEmployerSubmissionRow);

const listEmployerSubmissionsSince = (since) => {
  const normalizedSince = parseSince(since);
  if (!normalizedSince) return [];
  return db.prepare(`
    SELECT *
    FROM career_employer_submissions
    WHERE datetime(COALESCE(updated_at, created_at)) > datetime(?)
    ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
  `).all(normalizedSince).map(mapEmployerSubmissionRow);
};

const getLatestEmployerSubmissionTimestamp = () => {
  const row = db.prepare(`
    SELECT COALESCE(updated_at, created_at) AS latest_timestamp
    FROM career_employer_submissions
    ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
    LIMIT 1
  `).get();
  return row?.latest_timestamp || null;
};

const getEmployerSubmission = (id) => {
  const row = db.prepare("SELECT * FROM career_employer_submissions WHERE id = ?").get(id);
  return row ? mapEmployerSubmissionRow(row) : null;
};

const deleteEmployerSubmissionRecord = (id) => {
  const current = getEmployerSubmission(id);
  if (!current) return null;
  // Clean up the application-instructions file if one was attached
  const raw = db.prepare("SELECT application_instructions_file_id FROM career_employer_submissions WHERE id = ?").get(id);
  if (raw?.application_instructions_file_id) {
    deleteCareerFileRecord(raw.application_instructions_file_id);
  }
  // Clean up any files stored with owner_type 'employer-submission'
  const extraFiles = db.prepare("SELECT id FROM career_files WHERE owner_type = 'employer-submission' AND owner_id = ?").all(id);
  for (const f of extraFiles) deleteCareerFileRecord(f.id);
  db.prepare("DELETE FROM career_employer_submissions WHERE id = ?").run(id);
  deleteNotificationsFor("employer-submission", id);
  return current;
};

const deleteEmployerSubmission = (id) => {
  const transaction = db.transaction((submissionId) => deleteEmployerSubmissionRecord(submissionId));
  return transaction(id);
};

const bulkDeleteEmployerSubmissions = (ids = []) => {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => toInt(id)).filter(Boolean))];
  const transaction = db.transaction((submissionIds) => submissionIds
    .map((id) => deleteEmployerSubmissionRecord(id))
    .filter(Boolean));
  return transaction(uniqueIds);
};

const applicationSelectSql = `
  SELECT
    a.*,
    p.title AS job_title,
    p.company_name AS company_name,
    ap.applicant_code AS applicant_code,
    ap.full_name AS applicant_full_name,
    ap.first_name AS applicant_first_name,
    ap.last_name AS applicant_last_name,
    ap.email AS applicant_email,
    ap.normalized_email AS applicant_normalized_email,
    ap.phone AS applicant_phone,
    ap.created_at AS applicant_created_at,
    ap.updated_at AS applicant_updated_at,
    sa.id AS screening_applicant_id,
    sa.screening_status AS screening_status,
    sa.scores_json AS screening_scores_json,
    sa.ai_json AS screening_ai_json,
    sa.report_json AS screening_report_json,
    sa.screening_score AS screening_score_value,
    sa.tie_breaker_criteria_id AS screening_tie_breaker_criteria_id,
    sa.tie_breaker_points AS screening_tie_breaker_points,
    sa.final_score AS screening_final_score,
    sa.tie_breaker_reviewed AS screening_tie_breaker_reviewed,
    sa.sort_order AS screening_sort_order,
    sa.shortlist_decision AS screening_shortlist_decision,
    sa.shortlist_decided_at AS screening_shortlist_decided_at,
    sa.shortlist_decided_by AS screening_shortlist_decided_by,
    sa.saved_at AS screening_saved_at,
    sa.created_at AS screening_created_at,
    sa.updated_at AS screening_updated_at
  FROM career_job_applications a
  JOIN career_job_postings p ON p.id = a.job_posting_id
  LEFT JOIN career_applicants ap ON ap.id = a.applicant_id
  LEFT JOIN career_screening_applicants sa ON sa.application_id = a.id
`;

const mapApplicationRow = (row, fileMap = null) => {
  if (!row) return null;
  const files = fileMap || getFileMetaMap([row.cv_file_id, row.cover_letter_file_id, row.id_photo_file_id]);
  const cvFile = row.cv_file_id ? (files.get(row.cv_file_id) || null) : null;
  const coverLetterFile = row.cover_letter_file_id ? (files.get(row.cover_letter_file_id) || null) : null;
  const idPhotoFile = row.id_photo_file_id ? (files.get(row.id_photo_file_id) || null) : null;
  const applicant = mapApplicantRow(row.applicant_id ? {
    id: row.applicant_id,
    applicant_code: row.applicant_code,
    full_name: row.applicant_full_name || row.full_name,
    first_name: row.applicant_first_name,
    last_name: row.applicant_last_name,
    email: row.applicant_email || row.email,
    normalized_email: row.applicant_normalized_email || row.normalized_email || normalizeEmail(row.email),
    phone: row.applicant_phone || row.phone,
    created_at: row.applicant_created_at || row.created_at,
    updated_at: row.applicant_updated_at || row.updated_at
  } : null);
  const applicantId = applicant?.id || (row.applicant_id ? String(row.applicant_id) : String(row.id));
  const fullName = applicant?.fullName || getApplicantDisplayName({ fullName: row.full_name });
  const normalizedEmail = applicant?.normalizedEmail || row.normalized_email || normalizeEmail(row.email);
  const email = applicant?.email || row.email;
  const phone = applicant?.phone || row.phone || "";
  return {
    id: String(row.id),
    applicationId: String(row.id),
    applicantId,
    userId: applicantId,
    applicationCode: row.application_code,
    applicantCode: applicant?.applicantCode || "",
    firstName: applicant?.firstName || "",
    lastName: applicant?.lastName || "",
    fullName,
    name: fullName,
    email,
    normalizedEmail,
    phone,
    positionId: String(row.job_posting_id),
    positionTitle: row.job_title,
    companyName: row.company_name || "",
    status: row.status,
    offerStatus: deriveOfferStatusFromRow(row),
    offerStatusUpdatedAt: row.offer_status_updated_at || null,
    offerClosedAt: row.offer_closed_at || null,
    offerDeletedAt: row.offer_deleted_at || null,
    offerHistory: parseOfferHistory(row.offer_history_json),
    appliedAt: row.created_at,
    submittedAt: row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentLocation: row.current_location || "",
    yearsExperience: row.years_experience || "",
    coverLetterText: row.cover_letter_text || "",
    cvName: cvFile?.name || "",
    coverLetterName: coverLetterFile?.name || "",
    idPhotoName: idPhotoFile?.name || "",
    cvFile,
    coverLetterFile,
    idPhotoFile,
    cvComplete: Boolean(row.cv_file_id),
    screening: mapScreeningFromApplicationRow(row),
    shortlistReview: parseJson(row.shortlist_review_json, null),
    shortlistReport: parseJson(row.shortlist_report_json, null),
    shortlistReviewSavedAt: row.shortlist_review_saved_at || null,
    pipedrivePersonId: row.pipedrive_person_id || null,
    pipedriveDealId:   row.pipedrive_deal_id   || null
  };
};

const getAdminApplication = (id) => {
  const row = db.prepare(`
    ${applicationSelectSql}
    WHERE a.id = ?
  `).get(id);
  return mapApplicationRow(row);
};

const listApplications = ({ limit = null } = {}) => {
  const rows = db.prepare(`
    ${applicationSelectSql}
    ORDER BY datetime(COALESCE(a.updated_at, a.created_at)) DESC, a.id DESC
    ${Number.isInteger(limit) && limit > 0 ? `LIMIT ${Math.min(limit, 500)}` : ""}
  `).all();
  const fileMap = getFileMetaMap(rows.flatMap((row) => [row.cv_file_id, row.cover_letter_file_id, row.id_photo_file_id]));
  return rows.map((row) => mapApplicationRow(row, fileMap));
};

const listApplicationsSince = (since) => {
  const normalizedSince = parseSince(since);
  if (!normalizedSince) return [];
  const rows = db.prepare(`
    ${applicationSelectSql}
    WHERE datetime(COALESCE(a.updated_at, a.created_at)) > datetime(?)
    ORDER BY datetime(COALESCE(a.updated_at, a.created_at)) DESC, a.id DESC
  `).all(normalizedSince);
  const fileMap = getFileMetaMap(rows.flatMap((row) => [row.cv_file_id, row.cover_letter_file_id, row.id_photo_file_id]));
  return rows.map((row) => mapApplicationRow(row, fileMap));
};

const getLatestApplicationTimestamp = () => {
  const row = db.prepare(`
    SELECT COALESCE(updated_at, created_at) AS latest_timestamp
    FROM career_job_applications
    ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
    LIMIT 1
  `).get();
  return row?.latest_timestamp || null;
};

const writeStageHistory = (applicationId, fromStage, toStage, reason = "", changedBy = "admin") => {
  if (fromStage === toStage) return;
  db.prepare(`
    INSERT INTO career_application_stage_history
      (application_id, from_stage, to_stage, changed_by, reason, changed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(applicationId, fromStage || null, toStage, changedBy, reason || null, nowIso());
};

const upsertOfferRecord = (applicationId, offerStatus, historyJson, options = {}) => {
  const ts = options.timestamp || nowIso();
  const existing = db.prepare("SELECT id FROM career_offers WHERE application_id = ?").get(applicationId);
  if (existing) {
    db.prepare(`
      UPDATE career_offers
      SET offer_status   = ?,
          history_json   = ?,
          responded_at   = CASE WHEN ? IN ('closed','rejected','deleted') THEN ? ELSE responded_at END,
          updated_at     = ?
      WHERE application_id = ?
    `).run(offerStatus, historyJson || null, offerStatus, ts, ts, applicationId);
  } else {
    db.prepare(`
      INSERT INTO career_offers
        (application_id, offer_status, history_json, issued_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', ?, ?)
    `).run(applicationId, offerStatus, historyJson || null, ts, ts, ts);
  }
};

/** Update phone number on an application + applicant identity record */
const updateApplicantPhone = (applicationId, phone) => {
  const current = db.prepare("SELECT * FROM career_job_applications WHERE id = ?").get(applicationId);
  if (!current) return null;
  const safePhone = cleanText(phone).slice(0, 40);
  const ts = nowIso();
  db.prepare("UPDATE career_job_applications SET phone = ?, updated_at = ? WHERE id = ?")
    .run(safePhone, ts, applicationId);
  if (current.applicant_id) {
    db.prepare("UPDATE career_applicants SET phone = ?, updated_at = ? WHERE id = ?")
      .run(safePhone, ts, current.applicant_id);
  }
  return getAdminApplication(applicationId);
};

const updateApplicationStatus = (id, status) => {
  const current = db.prepare("SELECT * FROM career_job_applications WHERE id = ?").get(id);
  if (!current) return null;
  const prevStatus = normalizeApplicationStatus(current.status, "applied");
  const nextStatus = normalizeApplicationStatus(status, prevStatus);
  let offerPatch = {
    offer_status: current.offer_status,
    offer_status_updated_at: current.offer_status_updated_at,
    offer_closed_at: current.offer_closed_at,
    offer_deleted_at: current.offer_deleted_at,
    offer_history_json: current.offer_history_json
  };
  const currentOfferStatus = deriveOfferStatusFromRow(current);
  const ts = nowIso();

  if (nextStatus === "offer") {
    offerPatch = buildOfferStatusPatch(current, "pending", {
      reason: "Moved to offer stage",
      applicationStatus: nextStatus
    });
  } else if (nextStatus === "hired") {
    offerPatch = buildOfferStatusPatch(current, "closed", {
      reason: "Candidate hired / offer closed",
      applicationStatus: nextStatus
    });
  } else if (nextStatus === "rejected" && currentOfferStatus) {
    offerPatch = buildOfferStatusPatch(current, "rejected", {
      reason: "Offer rejected",
      applicationStatus: nextStatus
    });
  }

  db.prepare(`
    UPDATE career_job_applications
    SET status = ?,
        offer_status = ?,
        offer_status_updated_at = ?,
        offer_closed_at = ?,
        offer_deleted_at = ?,
        offer_history_json = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    nextStatus,
    offerPatch.offer_status,
    offerPatch.offer_status_updated_at,
    offerPatch.offer_closed_at,
    offerPatch.offer_deleted_at,
    offerPatch.offer_history_json,
    ts,
    id
  );

  /* ── Write stage history row ── */
  const reason = nextStatus === "offer"    ? "Moved to offer stage"
               : nextStatus === "hired"    ? "Candidate hired"
               : nextStatus === "rejected" ? "Application rejected"
               : "";
  writeStageHistory(id, prevStatus, nextStatus, reason);

  /* ── Sync career_offers table ── */
  if (offerPatch.offer_status && offerPatch.offer_status !== current.offer_status) {
    upsertOfferRecord(id, offerPatch.offer_status, offerPatch.offer_history_json, { timestamp: ts });
  }

  if (nextStatus === "interview") {
    db.prepare(`
      UPDATE shortlisted_applicants
      SET status = 'moved_to_interview',
          updated_at = ?
      WHERE application_id = ?
        AND status = 'active'
    `).run(ts, id);
  }
  return getAdminApplication(id);
};

/* ── Pipedrive ID storage ───────────────────────────────────────────────── */
const storePdApplicationIds = (id, personId, dealId) => {
  const sets = [];
  const vals = [];
  if (personId != null) { sets.push("pipedrive_person_id = ?"); vals.push(Number(personId)); }
  if (dealId   != null) { sets.push("pipedrive_deal_id = ?");   vals.push(Number(dealId)); }
  if (!sets.length) return;
  db.prepare(`UPDATE career_job_applications SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...vals, nowIso(), Number(id));
};

const storePdJobPostingIds = (id, orgId, dealId) => {
  const sets = [];
  const vals = [];
  if (orgId  != null) { sets.push("pipedrive_org_id = ?");  vals.push(Number(orgId)); }
  if (dealId != null) { sets.push("pipedrive_deal_id = ?"); vals.push(Number(dealId)); }
  if (!sets.length) return;
  db.prepare(`UPDATE career_job_postings SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...vals, nowIso(), Number(id));
};

const getJobPostingPdIds = (id) => {
  const row = db.prepare(
    "SELECT pipedrive_org_id, pipedrive_deal_id FROM career_job_postings WHERE id = ?"
  ).get(Number(id));
  return row ? { orgId: row.pipedrive_org_id || null, dealId: row.pipedrive_deal_id || null } : null;
};

const listOffers = ({ status = "all" } = {}) => {
  const requestedStatus = cleanText(status).toLowerCase() || "all";
  const rows = db.prepare(`
    ${applicationSelectSql}
    WHERE (a.offer_status IS NOT NULL OR lower(a.status) IN ('offer', 'hired'))
    ORDER BY COALESCE(a.offer_status_updated_at, a.updated_at, a.created_at) DESC, a.id DESC
  `).all();
  if (!rows.length) return [];
  const fileIds = rows.flatMap((r) => [r.cv_file_id, r.cover_letter_file_id, r.id_photo_file_id].filter(Boolean));
  const fileMap = fileIds.length ? getFileMetaMap(fileIds) : new Map();
  return rows
    .map((r) => mapApplicationRow(r, fileMap))
    .filter(Boolean)
    .filter((application) => {
      if (!application.offerStatus) return false;
      return requestedStatus === "all" || application.offerStatus === requestedStatus;
    });
};

const updateOfferStatus = (ids = [], offerStatus, options = {}) => {
  const targetIds = [...new Set((Array.isArray(ids) ? ids : [ids]).map((id) => toInt(id)).filter(Boolean))];
  const normalizedOfferStatus = normalizeOfferStatus(offerStatus);
  if (!normalizedOfferStatus) {
    throw new Error("Invalid offer status.");
  }
  if (!targetIds.length) {
    throw new Error("At least one offer record is required.");
  }

  const timestamp = nowIso();
  const reason = cleanText(options.reason) || (
    normalizedOfferStatus === "closed"
      ? "Marked closed from Offers tab"
      : normalizedOfferStatus === "rejected"
        ? "Marked rejected from Offers tab"
        : normalizedOfferStatus === "deleted"
          ? "Deleted from Offers tab"
          : "Offer status updated"
  );

  const transaction = db.transaction((applicationIds) => applicationIds.map((applicationId) => {
    const current = db.prepare("SELECT * FROM career_job_applications WHERE id = ?").get(applicationId);
    if (!current) return null;
    const patch = buildOfferStatusPatch(current, normalizedOfferStatus, {
      timestamp,
      reason,
      applicationStatus: current.status
    });

    db.prepare(`
      UPDATE career_job_applications
      SET offer_status = ?,
          offer_status_updated_at = ?,
          offer_closed_at = ?,
          offer_deleted_at = ?,
          offer_history_json = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      patch.offer_status,
      patch.offer_status_updated_at,
      patch.offer_closed_at,
      patch.offer_deleted_at,
      patch.offer_history_json,
      timestamp,
      applicationId
    );

    /* ── Sync career_offers + stage history ── */
    upsertOfferRecord(applicationId, patch.offer_status, patch.offer_history_json, { timestamp });
    writeStageHistory(applicationId, current.status, current.status,
      `Offer status changed to ${patch.offer_status}: ${reason}`);

    return getAdminApplication(applicationId);
  }).filter(Boolean));

  return transaction(targetIds);
};

const softDeleteOffers = (ids = [], options = {}) => updateOfferStatus(ids, "deleted", {
  reason: cleanText(options.reason) || "Soft-deleted from Offers tab"
});

const mapShortlistingCriteriaRow = (row) => ({
  id: String(row.id),
  positionId: String(row.position_id),
  createdBy: row.created_by || "",
  criteriaName: row.criteria_name,
  criteriaPayload: parseJson(row.criteria_payload, {}),
  thresholdScore: Number(row.threshold_score || 60),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const listShortlistingCriteria = (positionId) => {
  const postingId = toInt(positionId);
  if (!postingId) return [];
  return db.prepare(`
    SELECT *
    FROM shortlisting_criteria
    WHERE position_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
  `).all(postingId).map(mapShortlistingCriteriaRow);
};

const createShortlistingCriteria = (positionId, data = {}) => {
  const postingId = toInt(positionId);
  if (!postingId) throw new Error("Position is required.");
  const position = db.prepare("SELECT id FROM career_job_postings WHERE id = ?").get(postingId);
  if (!position) throw new Error("Position not found.");
  const criteriaName = cleanText(data.criteriaName || data.criteria_name || "Shortlisting Criteria");
  const payload = data.criteriaPayload && typeof data.criteriaPayload === "object" ? data.criteriaPayload : {};
  const thresholdScore = Number.isFinite(Number(data.thresholdScore))
    ? Math.min(Math.max(Number(data.thresholdScore), 0), 100)
    : 60;
  const timestamp = nowIso();
  const insert = db.prepare(`
    INSERT INTO shortlisting_criteria (
      position_id, created_by, criteria_name, criteria_payload, threshold_score, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(postingId, cleanText(data.createdBy), criteriaName, JSON.stringify(payload), thresholdScore, timestamp, timestamp);
  return mapShortlistingCriteriaRow(db.prepare("SELECT * FROM shortlisting_criteria WHERE id = ?").get(Number(insert.lastInsertRowid)));
};

const calculateScreeningPercent = (screeningApplicantRow = {}) => {
  const scores = parseJson(screeningApplicantRow.scores_json, {});
  const values = Object.values(scores || {}).map((item) => Number(item?.score)).filter(Number.isFinite);
  if (!values.length) return 0;
  const maxTotal = values.length * 10;
  const total = values.reduce((sum, value) => sum + value, 0);
  return maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
};

const runPositionShortlisting = (positionId, criteriaId) => {
  const postingId = toInt(positionId);
  const shortlistingCriteriaId = toInt(criteriaId);
  if (!postingId) throw new Error("Position is required.");
  if (!shortlistingCriteriaId) throw new Error("Shortlisting criteria is required.");
  const criteriaRow = db.prepare("SELECT * FROM shortlisting_criteria WHERE id = ?").get(shortlistingCriteriaId);
  if (!criteriaRow || Number(criteriaRow.position_id) !== postingId) {
    throw new Error("Shortlisting criteria does not belong to this position.");
  }
  const thresholdScore = Number(criteriaRow.threshold_score || 60);
  const screeningRows = db.prepare(`
    SELECT a.id AS application_id, a.status AS application_status, sa.id AS screening_result_id, sa.screening_status, sa.scores_json
    FROM career_job_applications a
    LEFT JOIN career_screening_applicants sa ON sa.application_id = a.id
    WHERE a.job_posting_id = ?
  `).all(postingId);

  const results = screeningRows.map((row) => {
    const screeningStatus = cleanText(row.screening_status).toLowerCase();
    const screeningComplete = ["screened", "recommended-shortlist", "in-review"].includes(screeningStatus);
    const shortlistScore = calculateScreeningPercent(row);
    const eligible = screeningComplete && shortlistScore >= thresholdScore;
    const nextStatus = eligible ? "shortlist_eligible" : (screeningComplete ? "not_shortlisted" : "screening");
    db.prepare(`
      UPDATE career_job_applications
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, nowIso(), row.application_id);
    return {
      applicationId: String(row.application_id),
      screeningResultId: row.screening_result_id ? String(row.screening_result_id) : null,
      shortlistScore,
      eligible
    };
  });

  return {
    positionId: String(postingId),
    shortlistingCriteriaId: String(shortlistingCriteriaId),
    thresholdScore,
    results,
    eligible: results.filter((item) => item.eligible)
  };
};

const pushToShortlist = ({ positionId, shortlistingCriteriaId, applicationIds = [], pushedBy = "" }) => {
  const postingId = toInt(positionId);
  const criteriaId = toInt(shortlistingCriteriaId);
  const ids = [...new Set((Array.isArray(applicationIds) ? applicationIds : []).map((id) => toInt(id)).filter(Boolean))];
  if (!postingId) throw new Error("Position ID is required.");
  if (!criteriaId) throw new Error("Shortlisting criteria ID is required.");
  if (!ids.length) throw new Error("At least one application is required.");
  const position = db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(postingId);
  if (!position) throw new Error("Position not found.");
  const criteria = db.prepare("SELECT * FROM shortlisting_criteria WHERE id = ?").get(criteriaId);
  if (!criteria || Number(criteria.position_id) !== postingId) throw new Error("Criteria does not belong to the selected position.");

  const blockedStatuses = new Set(["interview", "offer", "hired", "rejected", "closed"]);
  const pushedAt = nowIso();
  const pushed = [];
  const skipped = [];
  const errors = [];

  const transaction = db.transaction(() => {
    ids.forEach((applicationId) => {
      const row = db.prepare(`
        SELECT a.*, sa.id AS screening_result_id, sa.scores_json, sa.screening_status
        FROM career_job_applications a
        LEFT JOIN career_screening_applicants sa ON sa.application_id = a.id
        WHERE a.id = ?
      `).get(applicationId);
      if (!row) {
        errors.push({ applicationId: String(applicationId), error: "Application not found." });
        return;
      }
      if (Number(row.job_posting_id) !== postingId) {
        errors.push({ applicationId: String(applicationId), error: "Application does not belong to selected position." });
        return;
      }
      const status = normalizeApplicationStatus(row.status, "applied");
      if (blockedStatuses.has(status)) {
        skipped.push({ applicationId: String(applicationId), reason: `Already in ${status} stage.` });
        return;
      }
      const existingShortlisted = db.prepare(`
        SELECT * FROM shortlisted_applicants
        WHERE application_id = ?
          AND position_id = ?
          AND status = 'active'
      `).get(applicationId, postingId);
      if (existingShortlisted) {
        skipped.push({ applicationId: String(applicationId), reason: "Already shortlisted." });
        return;
      }

      const shortlistScore = calculateScreeningPercent(row);
      db.prepare(`
        INSERT INTO shortlisted_applicants (
          application_id, applicant_id, position_id, screening_result_id, shortlisting_criteria_id,
          shortlist_score, shortlist_reason, pushed_by, pushed_at, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        ON CONFLICT(application_id, position_id) DO UPDATE SET
          screening_result_id = excluded.screening_result_id,
          shortlisting_criteria_id = excluded.shortlisting_criteria_id,
          shortlist_score = excluded.shortlist_score,
          shortlist_reason = excluded.shortlist_reason,
          pushed_by = excluded.pushed_by,
          pushed_at = excluded.pushed_at,
          status = 'active',
          updated_at = excluded.updated_at
      `).run(applicationId, row.applicant_id || applicationId, postingId, row.screening_result_id || null, criteriaId, shortlistScore, "Pushed to shortlist", cleanText(pushedBy), pushedAt, pushedAt, pushedAt);

      db.prepare(`
        UPDATE career_job_applications
        SET status = 'shortlisted', updated_at = ?
        WHERE id = ?
      `).run(pushedAt, applicationId);
      pushed.push({ applicationId: String(applicationId), shortlistScore });
    });
  });

  transaction();
  const shortlistCount = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM shortlisted_applicants
    WHERE position_id = ?
      AND status = 'active'
  `).get(postingId)?.count || 0);
  return { pushed, skipped, errors, updatedShortlistCount: shortlistCount };
};

const listShortlistedApplicants = ({ positionId = null } = {}) => {
  const params = [];
  const where = ["s.status = 'active'", "lower(a.status) = 'shortlisted'"];
  if (toInt(positionId)) {
    where.push("s.position_id = ?");
    params.push(toInt(positionId));
  }
  const rows = db.prepare(`
    SELECT s.*, a.*, p.title AS job_title, p.company_name
    FROM shortlisted_applicants s
    JOIN career_job_applications a ON a.id = s.application_id
    JOIN career_job_postings p ON p.id = s.position_id
    WHERE ${where.join(" AND ")}
    ORDER BY datetime(COALESCE(s.updated_at, s.created_at)) DESC, s.id DESC
  `).all(...params);
  const fileMap = getFileMetaMap(rows.flatMap((row) => [row.cv_file_id, row.cover_letter_file_id, row.id_photo_file_id]));
  return rows.map((row) => ({
    ...mapApplicationRow(row, fileMap),
    shortlistMeta: {
      shortlistedRecordId: String(row.id),
      shortlistScore: Number(row.shortlist_score || 0),
      shortlistingCriteriaId: row.shortlisting_criteria_id ? String(row.shortlisting_criteria_id) : null,
      pushedBy: row.pushed_by || "",
      pushedAt: row.pushed_at || null
    }
  }));
};

const moveShortlistedToInterview = (applicationId) => {
  const id = toInt(applicationId);
  if (!id) throw new Error("Application is required.");
  const shortlisted = db.prepare(`
    SELECT * FROM shortlisted_applicants
    WHERE application_id = ?
      AND status = 'active'
  `).get(id);
  if (!shortlisted) throw new Error("Shortlisted applicant not found.");
  const timestamp = nowIso();
  db.prepare("UPDATE shortlisted_applicants SET status = 'moved_to_interview', updated_at = ? WHERE id = ?").run(timestamp, shortlisted.id);
  db.prepare("UPDATE career_job_applications SET status = 'interview', updated_at = ? WHERE id = ?").run(timestamp, id);
  return getAdminApplication(id);
};

const normalizeShortlistReview = (review = {}, current = {}) => {
  const next = {
    referenceChecksCompleted: parseBool(review.referenceChecksCompleted ?? current.referenceChecksCompleted),
    backgroundCheckRequired: parseBool(review.backgroundCheckRequired ?? current.backgroundCheckRequired),
    backgroundChecksCompleted: parseBool(review.backgroundChecksCompleted ?? current.backgroundChecksCompleted),
    credentialVerificationCompleted: parseBool(review.credentialVerificationCompleted ?? current.credentialVerificationCompleted),
    employmentHistoryVerified: parseBool(review.employmentHistoryVerified ?? current.employmentHistoryVerified),
    certificationsConfirmed: parseBool(review.certificationsConfirmed ?? current.certificationsConfirmed),
    riskFlagsDocumented: parseBool(review.riskFlagsDocumented ?? current.riskFlagsDocumented),
    riskFlagsSummary: cleanMultiline(review.riskFlagsSummary ?? current.riskFlagsSummary),
    meetsMandatoryRequirements: parseBool(review.meetsMandatoryRequirements ?? current.meetsMandatoryRequirements),
    meetsPreferredQualifications: parseBool(review.meetsPreferredQualifications ?? current.meetsPreferredQualifications),
    finalInterviewCompleted: parseBool(review.finalInterviewCompleted ?? current.finalInterviewCompleted),
    practicalAssessmentCompleted: parseBool(review.practicalAssessmentCompleted ?? current.practicalAssessmentCompleted),
    behavioralAssessmentCompleted: parseBool(review.behavioralAssessmentCompleted ?? current.behavioralAssessmentCompleted),
    technicalAssessmentCompleted: parseBool(review.technicalAssessmentCompleted ?? current.technicalAssessmentCompleted),
    finalAssessmentScore: review.finalAssessmentScore === "" || review.finalAssessmentScore === null || review.finalAssessmentScore === undefined
      ? null
      : Math.min(Math.max(Number(review.finalAssessmentScore), 0), 100),
    finalAssessmentRecommendation: cleanText(review.finalAssessmentRecommendation ?? current.finalAssessmentRecommendation).toLowerCase(),
    profilePrepared: parseBool(review.profilePrepared ?? current.profilePrepared),
    resumeAttached: parseBool(review.resumeAttached ?? current.resumeAttached),
    interviewNotesAttached: parseBool(review.interviewNotesAttached ?? current.interviewNotesAttached),
    assessmentResultsAttached: parseBool(review.assessmentResultsAttached ?? current.assessmentResultsAttached),
    checkStatusIncluded: parseBool(review.checkStatusIncluded ?? current.checkStatusIncluded),
    hiringManagerRecommendationIncluded: parseBool(review.hiringManagerRecommendationIncluded ?? current.hiringManagerRecommendationIncluded),
    readyForBoardReview: parseBool(review.readyForBoardReview ?? current.readyForBoardReview),
    strengthsSummary: cleanMultiline(review.strengthsSummary ?? current.strengthsSummary),
    concernsSummary: cleanMultiline(review.concernsSummary ?? current.concernsSummary),
    salaryExpectationsReviewed: parseBool(review.salaryExpectationsReviewed ?? current.salaryExpectationsReviewed),
    salaryExpectationAmount: cleanText(review.salaryExpectationAmount ?? current.salaryExpectationAmount),
    startDateConfirmed: parseBool(review.startDateConfirmed ?? current.startDateConfirmed),
    proposedStartDate: cleanText(review.proposedStartDate ?? current.proposedStartDate),
    culturalFitReviewed: parseBool(review.culturalFitReviewed ?? current.culturalFitReviewed),
    finalHiringRecommendation: cleanText(review.finalHiringRecommendation ?? current.finalHiringRecommendation).toLowerCase(),
    recruiterFinalNotes: cleanMultiline(review.recruiterFinalNotes ?? current.recruiterFinalNotes),
    savedByUserId: cleanText(review.savedByUserId ?? current.savedByUserId),
    savedAt: cleanText(review.savedAt ?? current.savedAt)
  };

  if (next.finalAssessmentRecommendation && !SHORTLIST_ASSESSMENT_RECOMMENDATIONS.has(next.finalAssessmentRecommendation)) {
    throw new Error("Invalid final assessment recommendation.");
  }
  if (next.finalHiringRecommendation && !SHORTLIST_REVIEW_DECISIONS.has(next.finalHiringRecommendation)) {
    throw new Error("Invalid final hiring recommendation.");
  }
  if (next.backgroundCheckRequired && !next.backgroundChecksCompleted && next.finalHiringRecommendation === "proceed") {
    throw new Error("Background checks must be completed before proceeding.");
  }
  if (next.finalHiringRecommendation === "proceed") {
    const requiredChecks = [
      ["referenceChecksCompleted", next.referenceChecksCompleted],
      ["credentialVerificationCompleted", next.credentialVerificationCompleted],
      ["employmentHistoryVerified", next.employmentHistoryVerified],
      ["meetsMandatoryRequirements", next.meetsMandatoryRequirements],
      ["finalInterviewCompleted", next.finalInterviewCompleted],
      ["profilePrepared", next.profilePrepared],
      ["resumeAttached", next.resumeAttached],
      ["interviewNotesAttached", next.interviewNotesAttached],
      ["hiringManagerRecommendationIncluded", next.hiringManagerRecommendationIncluded],
      ["salaryExpectationsReviewed", next.salaryExpectationsReviewed],
      ["startDateConfirmed", next.startDateConfirmed],
      ["culturalFitReviewed", next.culturalFitReviewed],
      ["readyForBoardReview", next.readyForBoardReview]
    ];
    const missingKey = requiredChecks.find(([, isDone]) => !isDone)?.[0];
    if (missingKey) throw new Error(`Cannot proceed until ${missingKey} is completed.`);
    if (!Number.isFinite(next.finalAssessmentScore)) {
      throw new Error("Final assessment score is required before proceeding.");
    }
  }

  return next;
};

const shortlistChecklistLabels = [
  ["referenceChecksCompleted", "Reference checks completed"],
  ["backgroundChecksCompleted", "Background checks completed"],
  ["credentialVerificationCompleted", "Credential verification completed"],
  ["employmentHistoryVerified", "Employment history verified"],
  ["certificationsConfirmed", "Certifications confirmed"],
  ["meetsMandatoryRequirements", "Mandatory requirements confirmed"],
  ["meetsPreferredQualifications", "Preferred qualifications confirmed"],
  ["finalInterviewCompleted", "Final interview completed"],
  ["practicalAssessmentCompleted", "Practical assessment completed"],
  ["behavioralAssessmentCompleted", "Behavioral assessment completed"],
  ["technicalAssessmentCompleted", "Technical assessment completed"],
  ["profilePrepared", "Profile prepared for review"],
  ["resumeAttached", "Resume attached"],
  ["interviewNotesAttached", "Interview notes attached"],
  ["assessmentResultsAttached", "Assessment results attached"],
  ["checkStatusIncluded", "Check status included"],
  ["hiringManagerRecommendationIncluded", "Hiring manager recommendation included"],
  ["salaryExpectationsReviewed", "Salary expectations reviewed"],
  ["startDateConfirmed", "Start date confirmed"],
  ["culturalFitReviewed", "Cultural fit reviewed"],
  ["readyForBoardReview", "Ready for board review"]
];

const humanizeChecklistValue = (value, fallback = "Not set") => {
  const text = cleanText(value);
  if (!text) return fallback;
  return text
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const buildShortlistChecklistReport = (applicationRow, review = {}) => {
  const checklistItems = shortlistChecklistLabels.map(([key, label]) => ({
    key,
    label,
    done: Boolean(review[key])
  }));
  const completed = checklistItems.filter((item) => item.done).length;
  const total = checklistItems.length;
  const outstandingItems = checklistItems.filter((item) => !item.done).slice(0, 6).map((item) => item.label);
  const decision = humanizeChecklistValue(review.finalHiringRecommendation, "Pending decision");
  const assessmentRecommendation = humanizeChecklistValue(review.finalAssessmentRecommendation, "Pending assessment");
  const generatedAt = nowIso();
  const summary = review.finalHiringRecommendation === "proceed"
    ? "Checklist is complete enough to move forward in the hiring decision flow."
    : review.finalHiringRecommendation === "hold"
      ? "Checklist has been saved and the candidate is currently on hold pending follow-up."
      : review.finalHiringRecommendation === "reject"
        ? "Checklist has been saved with a reject recommendation."
        : "Checklist has been saved and is waiting for a final hiring decision.";

  const lines = [
    `Applicant: ${applicationRow.full_name || "Unnamed applicant"}`,
    `Position: ${applicationRow.job_title || "Unknown position"}`,
    `Checklist completion: ${completed}/${total}`,
    `Decision: ${decision}`,
    `Assessment recommendation: ${assessmentRecommendation}`,
    Number.isFinite(review.finalAssessmentScore) ? `Assessment score: ${review.finalAssessmentScore}/100` : "Assessment score: Not set",
    review.salaryExpectationAmount ? `Salary expectation: ${review.salaryExpectationAmount}` : "Salary expectation: Not set",
    review.proposedStartDate ? `Proposed start date: ${review.proposedStartDate}` : "Proposed start date: Not set",
    outstandingItems.length ? `Outstanding items: ${outstandingItems.join(", ")}` : "Outstanding items: None"
  ];

  if (review.strengthsSummary) {
    lines.push(`Strengths: ${review.strengthsSummary}`);
  }
  if (review.concernsSummary) {
    lines.push(`Concerns: ${review.concernsSummary}`);
  }
  if (review.recruiterFinalNotes) {
    lines.push(`Recruiter notes: ${review.recruiterFinalNotes}`);
  }

  return {
    generatedAt,
    summary,
    completion: {
      completed,
      total,
      percentage: total ? Math.round((completed / total) * 100) : 0
    },
    decision: review.finalHiringRecommendation || "",
    decisionLabel: decision,
    assessmentRecommendation: review.finalAssessmentRecommendation || "",
    assessmentRecommendationLabel: assessmentRecommendation,
    finalAssessmentScore: Number.isFinite(review.finalAssessmentScore) ? review.finalAssessmentScore : null,
    outstandingItems,
    text: lines.join("\n")
  };
};

const defaultFinalChecklist = (applicationRow = null) => ({
  applicantId: applicationRow ? String(applicationRow.applicantId || applicationRow.applicant_id || applicationRow.id) : "",
  applicationId: applicationRow ? String(applicationRow.id) : "",
  positionId: applicationRow ? String(applicationRow.positionId || applicationRow.job_posting_id) : "",
  referenceChecksCompleted: false,
  backgroundCheckCompleted: false,
  credentialVerificationCompleted: false,
  employmentHistoryVerified: false,
  requiredQualificationsConfirmed: false,
  finalInterviewCompleted: false,
  finalAssessmentCompleted: false,
  hiringManagerRecommendationCompleted: false,
  readyForBoardReview: false,
  salaryExpectationsReviewed: false,
  availabilityConfirmed: false,
  finalRecommendation: "",
  checklistNotes: "",
  generatedReport: null,
  createdAt: null,
  updatedAt: null
});

const buildFinalChecklistReport = ({ application, checklist }) => {
  const checks = [
    ["Reference checks", checklist.referenceChecksCompleted],
    ["Background check", checklist.backgroundCheckCompleted],
    ["Credential verification", checklist.credentialVerificationCompleted],
    ["Employment history", checklist.employmentHistoryVerified],
    ["Required qualifications", checklist.requiredQualificationsConfirmed],
    ["Final interview", checklist.finalInterviewCompleted],
    ["Final assessment", checklist.finalAssessmentCompleted],
    ["Hiring manager recommendation", checklist.hiringManagerRecommendationCompleted],
    ["Ready for board review", checklist.readyForBoardReview],
    ["Salary expectations reviewed", checklist.salaryExpectationsReviewed],
    ["Availability/start date confirmed", checklist.availabilityConfirmed]
  ];
  const completed = checks.filter(([, done]) => done).length;
  const missing = checks.filter(([, done]) => !done).map(([label]) => label);
  const recommendation = cleanText(checklist.finalRecommendation) || "Not set";
  const statusText = checklist.readyForBoardReview ? "Ready for final review" : "Not ready for final review";
  const updatedAt = nowIso();
  return {
    candidateName: application?.name || "Unknown candidate",
    position: application?.positionTitle || "Unknown position",
    recommendation,
    completedChecks: completed,
    totalChecks: checks.length,
    missingChecks: missing,
    notes: checklist.checklistNotes || "",
    status: statusText,
    updatedAt,
    text: [
      "Final Checklist Report",
      `Candidate: ${application?.name || "Unknown candidate"}`,
      `Position: ${application?.positionTitle || "Unknown position"}`,
      `Recommendation: ${recommendation}`,
      `Completed Checks: ${completed} of ${checks.length}`,
      `Missing Checks: ${missing.length ? missing.join(", ") : "None"}`,
      `Notes: ${checklist.checklistNotes || "Not provided"}`,
      `Status: ${statusText}`,
      `Last Updated: ${updatedAt}`
    ].join("\n")
  };
};

const getShortlistedChecklist = (applicantId) => {
  const id = toInt(applicantId);
  if (!id) return null;
  const application = getAdminApplication(id);
  if (!application) return null;
  const row = db.prepare(`
    SELECT *
    FROM shortlisted_final_checklists
    WHERE application_id = ?
  `).get(id);
  if (!row) {
    return defaultFinalChecklist({ id, applicantId: application.applicantId, positionId: Number(application.positionId) });
  }
  return {
    applicantId: String(row.applicant_id),
    applicationId: String(row.application_id),
    positionId: String(row.position_id),
    referenceChecksCompleted: Boolean(row.reference_checks_completed),
    backgroundCheckCompleted: Boolean(row.background_check_completed),
    credentialVerificationCompleted: Boolean(row.credential_verification_completed),
    employmentHistoryVerified: Boolean(row.employment_history_verified),
    requiredQualificationsConfirmed: Boolean(row.required_qualifications_confirmed),
    finalInterviewCompleted: Boolean(row.final_interview_completed),
    finalAssessmentCompleted: Boolean(row.final_assessment_completed),
    hiringManagerRecommendationCompleted: Boolean(row.hiring_manager_recommendation_completed),
    readyForBoardReview: Boolean(row.ready_for_board_review),
    salaryExpectationsReviewed: Boolean(row.salary_expectations_reviewed),
    availabilityConfirmed: Boolean(row.availability_confirmed),
    finalRecommendation: row.final_recommendation || "",
    checklistNotes: row.checklist_notes || "",
    generatedReport: parseJson(row.generated_report, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const saveShortlistedChecklist = (applicantId, payload = {}) => {
  const id = toInt(applicantId);
  if (!id) throw new Error("Applicant ID is required.");
  const application = getAdminApplication(id);
  if (!application) throw new Error("Applicant not found.");
  const positionId = toInt(payload.positionId || application.positionId);
  const applicationId = toInt(payload.applicationId || application.id);
  const applicantIdentityId = toInt(payload.applicantId || application.applicantId);
  if (!positionId || !applicationId) throw new Error("Application and position are required.");
  if (!applicantIdentityId) throw new Error("Applicant identity is required.");
  const checklist = {
    referenceChecksCompleted: parseBool(payload.referenceChecksCompleted),
    backgroundCheckCompleted: parseBool(payload.backgroundCheckCompleted),
    credentialVerificationCompleted: parseBool(payload.credentialVerificationCompleted),
    employmentHistoryVerified: parseBool(payload.employmentHistoryVerified),
    requiredQualificationsConfirmed: parseBool(payload.requiredQualificationsConfirmed),
    finalInterviewCompleted: parseBool(payload.finalInterviewCompleted),
    finalAssessmentCompleted: parseBool(payload.finalAssessmentCompleted),
    hiringManagerRecommendationCompleted: parseBool(payload.hiringManagerRecommendationCompleted),
    readyForBoardReview: parseBool(payload.readyForBoardReview),
    salaryExpectationsReviewed: parseBool(payload.salaryExpectationsReviewed),
    availabilityConfirmed: parseBool(payload.availabilityConfirmed),
    finalRecommendation: cleanText(payload.finalRecommendation),
    checklistNotes: cleanMultiline(payload.checklistNotes)
  };
  if (!["", "Proceed", "Hold", "Reject", "Needs More Review"].includes(checklist.finalRecommendation)) {
    throw new Error("Invalid final recommendation.");
  }
  const report = buildFinalChecklistReport({ application, checklist });
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO shortlisted_final_checklists (
      applicant_id, application_id, position_id, reference_checks_completed, background_check_completed,
      credential_verification_completed, employment_history_verified, required_qualifications_confirmed,
      final_interview_completed, final_assessment_completed, hiring_manager_recommendation_completed,
      ready_for_board_review, salary_expectations_reviewed, availability_confirmed, final_recommendation,
      checklist_notes, generated_report, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(application_id) DO UPDATE SET
      applicant_id = excluded.applicant_id,
      position_id = excluded.position_id,
      reference_checks_completed = excluded.reference_checks_completed,
      background_check_completed = excluded.background_check_completed,
      credential_verification_completed = excluded.credential_verification_completed,
      employment_history_verified = excluded.employment_history_verified,
      required_qualifications_confirmed = excluded.required_qualifications_confirmed,
      final_interview_completed = excluded.final_interview_completed,
      final_assessment_completed = excluded.final_assessment_completed,
      hiring_manager_recommendation_completed = excluded.hiring_manager_recommendation_completed,
      ready_for_board_review = excluded.ready_for_board_review,
      salary_expectations_reviewed = excluded.salary_expectations_reviewed,
      availability_confirmed = excluded.availability_confirmed,
      final_recommendation = excluded.final_recommendation,
      checklist_notes = excluded.checklist_notes,
      generated_report = excluded.generated_report,
      updated_at = excluded.updated_at
  `).run(
    applicantIdentityId, applicationId, positionId,
    boolInt(checklist.referenceChecksCompleted), boolInt(checklist.backgroundCheckCompleted),
    boolInt(checklist.credentialVerificationCompleted), boolInt(checklist.employmentHistoryVerified),
    boolInt(checklist.requiredQualificationsConfirmed), boolInt(checklist.finalInterviewCompleted),
    boolInt(checklist.finalAssessmentCompleted), boolInt(checklist.hiringManagerRecommendationCompleted),
    boolInt(checklist.readyForBoardReview), boolInt(checklist.salaryExpectationsReviewed),
    boolInt(checklist.availabilityConfirmed), checklist.finalRecommendation, checklist.checklistNotes,
    JSON.stringify(report), timestamp, timestamp
  );
  return getShortlistedChecklist(id);
};

const saveApplicationShortlistReview = (applicationId, data = {}) => {
  const applicantId = toInt(applicationId);
  if (!applicantId) return null;
  const current = db.prepare("SELECT * FROM career_job_applications WHERE id = ?").get(applicantId);
  if (!current) return null;

  const existing = parseJson(current.shortlist_review_json, {});
  const timestamp = nowIso();
  const shortlistReview = normalizeShortlistReview({
    ...(data.shortlistReview || {}),
    savedAt: timestamp
  }, existing);
  const applicationRow = db.prepare(`
    ${applicationSelectSql}
    WHERE a.id = ?
  `).get(applicantId);
  const shortlistReport = buildShortlistChecklistReport(applicationRow || current, shortlistReview);

  db.prepare(`
    UPDATE career_job_applications
    SET shortlist_review_json = ?,
        shortlist_report_json = ?,
        shortlist_review_saved_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(shortlistReview), JSON.stringify(shortlistReport), timestamp, timestamp, applicantId);

  return getAdminApplication(applicantId);
};

const normalizeCriterion = (criterion = {}, index = 0) => {
  const maxPoints = toInt(criterion.maxPoints, 10);
  const weight = toInt(criterion.weight, 1);
  return {
    id: cleanText(criterion.id) || `crit-${Date.now().toString(36)}-${index}`,
    name: cleanText(criterion.name),
    description: cleanText(criterion.description),
    maxPoints: Math.min(Math.max(maxPoints || 10, 1), 20),
    weight: Math.min(Math.max(weight || 1, 1), 5),
    required: Boolean(criterion.required),
    notes: cleanMultiline(criterion.notes)
  };
};

const ensurePositionScreeningRow = (positionId) => {
  let screeningId = db.prepare(`
    SELECT id
    FROM career_screenings
    WHERE job_posting_id = ?
  `).get(positionId)?.id;

  if (!screeningId) {
    const timestamp = nowIso();
    const insert = db.prepare(`
      INSERT INTO career_screenings (
        job_posting_id, criteria_json, rankings_json, pushed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(positionId, JSON.stringify([]), JSON.stringify([]), timestamp, timestamp, timestamp);
    screeningId = Number(insert.lastInsertRowid);
  }

  return screeningId;
};

const updatePositionKpiCriteria = (positionId, data = {}) => {
  const postingId = toInt(positionId);
  if (!postingId) return null;
  const posting = db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(postingId);
  if (!posting) return null;

  const screeningId = ensurePositionScreeningRow(postingId);
  const current = db.prepare(`
    SELECT *
    FROM career_screenings
    WHERE id = ?
  `).get(screeningId);
  const nextCriteria = Array.isArray(data.criteria)
    ? data.criteria.map((criterion, index) => normalizeCriterion(criterion, index)).filter((criterion) => criterion.name)
    : parseJson(current?.criteria_json, []);
  const nextRankings = Array.isArray(data.rankings)
    ? data.rankings.map((id) => String(id)).filter(Boolean)
    : parseJson(current?.rankings_json, []);
  const timestamp = nowIso();

  db.prepare(`
    UPDATE career_screenings
    SET criteria_json = ?, rankings_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(nextCriteria), JSON.stringify(nextRankings), timestamp, screeningId);

  return {
    position: getJobPosting(postingId),
    screening: mapScreeningForPosition(postingId)
  };
};

const createScreeningTieBreakerCriteria = (positionId, data = {}) => {
  const postingId = toInt(positionId);
  if (!postingId) throw new Error("Position is required.");
  const posting = db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(postingId);
  if (!posting) throw new Error("Position not found.");
  const screeningId = ensurePositionScreeningRow(postingId);
  const timestamp = nowIso();
  const name = cleanText(data.name);
  if (!name) throw new Error("Tie-breaker criteria name is required.");
  const description = cleanMultiline(data.description);
  const maxPoints = validateTieBreakerPoints(data.maxPoints === undefined ? TIE_BREAKER_MAX_POINTS : data.maxPoints);
  const screeningRunId = cleanText(data.screeningRunId || data.screeningId || String(screeningId));
  const createdBy = cleanText(data.createdBy || data.actor || data.user || "");

  const insert = db.prepare(`
    INSERT INTO career_screening_tie_breaker_criteria (
      job_posting_id, screening_id, screening_run_id, criteria_type, criteria_name, criteria_description,
      max_points, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'tie_breaker', ?, ?, ?, ?, ?, ?)
  `).run(postingId, screeningId, screeningRunId || null, name, description, maxPoints, createdBy, timestamp, timestamp);

  db.prepare(`
    UPDATE career_screenings
    SET tie_breaker_enabled = 1,
        updated_at = ?
    WHERE id = ?
  `).run(timestamp, screeningId);

  const criteriaId = Number(insert.lastInsertRowid);
  return listTieBreakerCriteria(postingId).find((item) => Number(item.id) === criteriaId) || null;
};

const updateScreeningTieBreakerCriteria = (criteriaId, data = {}) => {
  const id = toInt(criteriaId);
  if (!id) throw new Error("Tie-breaker criteria is required.");
  const current = db.prepare(`
    SELECT *
    FROM career_screening_tie_breaker_criteria
    WHERE id = ?
  `).get(id);
  if (!current) throw new Error("Tie-breaker criteria not found.");
  const timestamp = nowIso();
  const name = data.name === undefined ? current.criteria_name : cleanText(data.name);
  if (!name) throw new Error("Tie-breaker criteria name is required.");
  const description = data.description === undefined ? (current.criteria_description || "") : cleanMultiline(data.description);
  const maxPoints = data.maxPoints === undefined ? Number(current.max_points || TIE_BREAKER_MAX_POINTS) : validateTieBreakerPoints(data.maxPoints);

  db.prepare(`
    UPDATE career_screening_tie_breaker_criteria
    SET criteria_name = ?,
        criteria_description = ?,
        max_points = ?,
        updated_at = ?
    WHERE id = ?
  `).run(name, description, maxPoints, timestamp, id);

  return listTieBreakerCriteria(current.job_posting_id).find((item) => Number(item.id) === id) || null;
};

const getScreeningTieBreakerCriteria = (criteriaId) => {
  const id = toInt(criteriaId);
  if (!id) return null;
  const row = db.prepare(`
    SELECT job_posting_id
    FROM career_screening_tie_breaker_criteria
    WHERE id = ?
  `).get(id);
  if (!row) return null;
  return listTieBreakerCriteria(row.job_posting_id).find((item) => Number(item.id) === id) || null;
};

const normalizeScreeningScoreMap = (scores = {}, criteria = []) => {
  const criteriaById = new Map(criteria.map((criterion) => [String(criterion.id), criterion]));
  return Object.entries(scores || {}).reduce((accumulator, [criterionId, rawValue]) => {
    const normalizedCriterionId = cleanText(criterionId);
    if (!normalizedCriterionId) return accumulator;
    const criterion = criteriaById.get(normalizedCriterionId);
    const item = rawValue && typeof rawValue === "object" ? rawValue : {};
    const scoreValue = item.score === "" || item.score === null || item.score === undefined ? null : Number(item.score);
    const maxPoints = criterion?.maxPoints || 10;
    const normalized = {
      mark: ["pass", "needs-review", "fail"].includes(cleanText(item.mark).toLowerCase()) ? cleanText(item.mark).toLowerCase() : "",
      notes: cleanMultiline(item.notes)
    };

    if (Number.isFinite(scoreValue)) {
      normalized.score = Math.min(Math.max(Math.round(scoreValue), 0), maxPoints);
    }
    if (normalized.score === undefined && !normalized.mark && !normalized.notes) {
      return accumulator;
    }

    accumulator[normalizedCriterionId] = normalized;
    return accumulator;
  }, {});
};

const buildPositionScreeningWorkspace = (positionId) => {
  const postingId = toInt(positionId);
  if (!postingId) throw new Error("Position is required.");
  const position = getJobPosting(postingId);
  if (!position) throw new Error("Position not found.");
  const screening = mapScreeningForPosition(postingId) || { criteria: [], rankings: [], lastSortDirection: "" };
  const tieBreakerCriteria = screening.tieBreakerCriteria || [];
  const activeTieBreakerCriteria = tieBreakerCriteria.find((item) => item.criteriaType === "tie_breaker") || null;
  const criteria = screening.criteria || [];
  const activeStatuses = ["screening", "screened", "shortlist_eligible", "applied", "new"];
  const applicationRows = db.prepare(`
    ${applicationSelectSql}
    WHERE a.job_posting_id = ?
      AND lower(a.status) IN (${activeStatuses.map(() => "?").join(", ")})
    ORDER BY COALESCE(sa.sort_order, 999999) ASC, datetime(COALESCE(a.updated_at, a.created_at)) DESC, a.id DESC
  `).all(postingId, ...activeStatuses);

  const applicants = applicationRows.map((row) => {
    const application = mapApplicationRow(row);
    const snapshot = buildApplicantRankingSnapshot({ application, criteria });
    return {
      ...snapshot,
      screening: {
        ...(snapshot.screening || {}),
        tieBreakerCriteriaId: cleanText(snapshot?.screening?.tieBreakerCriteriaId)
      }
    };
  });

  const tieAnalysis = detectScreeningTieGroups(applicants);
  const tieGroups = tieAnalysis.tieGroups;
  const nearTieGroups = tieAnalysis.nearTieGroups;
  const candidateTieGroups = tieAnalysis.candidateGroups;
  const tieApplicantIds = new Set(candidateTieGroups.flatMap((group) => group.applicationIds));
  const unresolvedTieGroups = candidateTieGroups.filter((group) => !group.reviewed);
  const selectedForShortlist = applicants.filter((application) => application?.screening?.shortlistDecision === "shortlisted");
  const summary = {
    totalApplicants: applicants.length,
    completeApplicants: applicants.filter((application) => application.screeningReady).length,
    incompleteApplicants: applicants.filter((application) => application.screeningIncomplete).length,
    tieGroups: tieGroups.length,
    nearTieGroups: nearTieGroups.length,
    unresolvedTieGroups: unresolvedTieGroups.length,
    shortlistedSelections: selectedForShortlist.length,
    canPush: Boolean(
      screening.lastSortedAt
      && !screening.rankingNeedsRefresh
      && applicants.length > 0
      && applicants.every((application) => application.screeningReady)
      && unresolvedTieGroups.length === 0
      && selectedForShortlist.length > 0
    ),
    hasTiedScores: tieGroups.length > 0,
    hasNearTies: nearTieGroups.length > 0,
    tieBreakerAvailable: Boolean(screening.lastSortedAt && candidateTieGroups.length > 0),
    tieBreakerEnabled: Boolean(screening.tieBreakerEnabled)
  };

  return {
    position,
    screening,
    applicants: applicants.map((application) => ({
      ...application,
      screening: {
        ...(application.screening || {}),
        tieGroupId: candidateTieGroups.find((group) => group.applicationIds.includes(String(application.id)))?.id || "",
        tieStatus: candidateTieGroups.find((group) => group.applicationIds.includes(String(application.id)))?.reason || "",
        isTie: tieApplicantIds.has(String(application.id)),
        tieReviewed: !tieApplicantIds.has(String(application.id)) || Boolean(application?.screening?.tieBreakerReviewed)
      }
    })),
    tieGroups,
    nearTieGroups,
    tieBreakerCriteria,
    activeTieBreakerCriteria,
    unresolvedTieGroups,
    summary
  };
};

const saveApplicationScreening = (applicationId, data = {}) => {
  const applicantId = toInt(applicationId);
  if (!applicantId) return null;
  const applicationRow = db.prepare("SELECT * FROM career_job_applications WHERE id = ?").get(applicantId);
  if (!applicationRow) return null;

  const screeningId = ensurePositionScreeningRow(applicationRow.job_posting_id);
  const screeningRow = db.prepare(`
    SELECT *
    FROM career_screenings
    WHERE id = ?
  `).get(screeningId);
  const criteria = parseJson(screeningRow?.criteria_json, []);
  const existing = db.prepare(`
    SELECT *
    FROM career_screening_applicants
    WHERE application_id = ?
  `).get(applicantId);
  const existingReport = parseJson(existing?.report_json, { content: "", recommendation: "" });
  const nextReport = {
    content: cleanMultiline(data.report?.content ?? existingReport.content ?? ""),
    recommendation: cleanText(data.report?.recommendation ?? existingReport.recommendation ?? "")
  };
  const nextScores = normalizeScreeningScoreMap(data.scores ?? parseJson(existing?.scores_json, {}), criteria);
  const nextAi = data.ai === undefined ? parseJson(existing?.ai_json, null) : data.ai;
  const requestedStatus = cleanText(data.status || existing?.screening_status).toLowerCase();
  const hasScoredContent = Object.keys(nextScores).length > 0 || Boolean(nextReport.content) || Boolean(nextReport.recommendation);
  const nextStatus = requestedStatus
    || (hasScoredContent ? "screened" : "not-started");
  const metrics = calculateScreeningMetrics(nextScores, criteria);
  const screeningScore = metrics.screeningScore;
  const previousScreeningScore = Number(existing?.screening_score || 0);
  const previousTieBreakerPoints = Number(existing?.tie_breaker_points || 0);
  const previousTieBreakerCriteriaId = existing?.tie_breaker_criteria_id === null || existing?.tie_breaker_criteria_id === undefined
    ? null
    : Number(existing.tie_breaker_criteria_id);
  const scoreChanged = !existing || roundScore(previousScreeningScore, 2) !== roundScore(screeningScore, 2);
  const tieBreakerPoints = previousTieBreakerPoints;
  const tieBreakerReviewed = scoreChanged ? 0 : boolInt(Boolean(existing?.tie_breaker_reviewed));
  const finalScore = calculateFinalScreeningScore(screeningScore, tieBreakerPoints);
  const timestamp = nowIso();

  if (existing) {
    db.prepare(`
      UPDATE career_screening_applicants
      SET screening_id = ?,
          screening_status = ?,
          scores_json = ?,
          ai_json = ?,
          report_json = ?,
          screening_score = ?,
          tie_breaker_criteria_id = ?,
          tie_breaker_points = ?,
          tie_breaker_reviewed = ?,
          final_score = ?,
          saved_at = ?,
          updated_at = ?
      WHERE application_id = ?
    `).run(
      screeningId,
      nextStatus,
      JSON.stringify(nextScores),
      nextAi === null ? "null" : JSON.stringify(nextAi),
      JSON.stringify(nextReport),
      screeningScore,
      previousTieBreakerCriteriaId,
      tieBreakerPoints,
      tieBreakerReviewed,
      finalScore,
      timestamp,
      timestamp,
      applicantId
    );
  } else {
    db.prepare(`
      INSERT INTO career_screening_applicants (
        screening_id, application_id, screening_status, scores_json, ai_json, report_json,
        screening_score, tie_breaker_criteria_id, tie_breaker_points, final_score, tie_breaker_reviewed, saved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, 0, ?, ?, ?)
    `).run(
      screeningId,
      applicantId,
      nextStatus,
      JSON.stringify(nextScores),
      nextAi === null ? "null" : JSON.stringify(nextAi),
      JSON.stringify(nextReport),
      screeningScore,
      finalScore,
      timestamp,
      timestamp,
      timestamp
    );
  }

  db.prepare(`
    UPDATE career_job_applications
    SET updated_at = ?
    WHERE id = ?
  `).run(timestamp, applicantId);

  if (scoreChanged) {
    db.prepare(`
      UPDATE career_screenings
      SET ranking_needs_refresh = 1,
          updated_at = ?
      WHERE id = ?
    `).run(timestamp, screeningId);
  }

  return {
    application: getAdminApplication(applicantId),
    screening: mapScreeningForApplicant(applicantId)
  };
};

const listPositionScreenings = ({ positionId = null } = {}) => {
  if (positionId !== null && positionId !== undefined && positionId !== "") {
    return buildPositionScreeningWorkspace(positionId);
  }

  const positions = listJobPostingRows("WHERE p.status = 'screening'").map((row) => {
    const workspace = buildPositionScreeningWorkspace(row.id);
    return {
      position: workspace.position,
      screening: workspace.screening,
      summary: workspace.summary,
      tieGroups: workspace.tieGroups
    };
  });

  return { positions };
};

const sortPositionScreeningApplicants = (positionId, data = {}) => {
  const postingId = toInt(positionId);
  if (!postingId) throw new Error("Position is required.");
  const screeningId = ensurePositionScreeningRow(postingId);
  const workspace = buildPositionScreeningWorkspace(postingId);
  if (!workspace.applicants.length) {
    throw new Error("No applicants available for screening.");
  }
  if (!workspace.applicants.every((application) => application.screeningReady)) {
    throw new Error("All applicants must be fully scored before sorting.");
  }

  const direction = cleanText(data.direction).toLowerCase() === "desc" ? "desc" : "asc";
  const sortedBy = cleanText(data.sortedBy || data.actor || data.user || "");
  const rankedApplicants = sortScreeningApplicantsByScore(
    workspace.applicants.map((application) => buildApplicantRankingSnapshot({ application, criteria: workspace.screening?.criteria || [] })),
    direction,
    "screeningScore"
  );

  const timestamp = nowIso();
  const transaction = db.transaction(() => {
    rankedApplicants.forEach((application, index) => {
      const screeningScore = Number(application?.screening?.screeningScore || 0);
      const tieBreakerPoints = Number(application?.screening?.tieBreakerPoints || 0);
      const finalScore = calculateFinalScreeningScore(screeningScore, tieBreakerPoints);
      db.prepare(`
        UPDATE career_screening_applicants
        SET screening_score = ?,
            tie_breaker_points = ?,
            final_score = ?,
            sort_order = ?,
            updated_at = ?
        WHERE application_id = ?
      `).run(screeningScore, tieBreakerPoints, finalScore, index + 1, timestamp, Number(application.id));
    });

    db.prepare(`
      UPDATE career_screenings
      SET rankings_json = ?,
          last_sorted_at = ?,
          last_sorted_by = ?,
          last_sort_direction = ?,
          ranking_needs_refresh = 0,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(rankedApplicants.map((application) => String(application.id))),
      timestamp,
      sortedBy,
      direction,
      timestamp,
      screeningId
    );
  });

  transaction();
  const nextWorkspace = buildPositionScreeningWorkspace(postingId);
  return {
    ...nextWorkspace,
    rankingConfig: {
      mode: "criteria-score-sheet",
      direction,
      sortedBy,
      criteriaCount: nextWorkspace.screening?.criteria?.length || 0
    }
  };
};

const sortPositionScreeningApplicantsWithTieBreaker = (positionId, data = {}) => {
  const postingId = toInt(positionId);
  if (!postingId) throw new Error("Position is required.");
  const workspace = buildPositionScreeningWorkspace(postingId);
  if (!workspace.screening?.lastSortedAt) {
    throw new Error("Sort applicants by screening score before applying a tie-breaker.");
  }
  const direction = cleanText(data.direction || workspace.screening?.lastSortDirection).toLowerCase() === "asc" ? "asc" : "desc";
  const applicants = workspace.applicants;
  if (!applicants.length) throw new Error("No applicants available for screening.");
  const candidateTieGroups = [...(workspace.tieGroups || []), ...(workspace.nearTieGroups || [])];
  if (!candidateTieGroups.length) {
    throw new Error("No tied or near-tied applicants require a tie-breaker.");
  }

  const tieBreakerCriteriaId = data.tieBreakerCriteriaId === undefined || data.tieBreakerCriteriaId === null || data.tieBreakerCriteriaId === ""
    ? null
    : toInt(data.tieBreakerCriteriaId);
  const savedCriteria = tieBreakerCriteriaId
    ? db.prepare("SELECT * FROM career_screening_tie_breaker_criteria WHERE id = ?").get(tieBreakerCriteriaId)
    : null;
  if (tieBreakerCriteriaId && !savedCriteria) {
    throw new Error("Tie-breaker criteria not found.");
  }

  const tieBreakerMap = new Map(
    (Array.isArray(data.tieBreakers) ? data.tieBreakers : [])
      .map((item) => [toInt(item?.applicationId), item])
      .filter(([applicationId]) => applicationId)
  );
  const sortedBy = cleanText(data.sortedBy || data.actor || data.user || "");
  const screeningId = ensurePositionScreeningRow(postingId);
  const timestamp = nowIso();

  const transaction = db.transaction(() => {
    applicants.forEach((application) => {
      const applicationId = toInt(application.id);
      const patch = tieBreakerMap.get(applicationId);
      const shouldUpdate = patch || candidateTieGroups.some((group) => group.applicationIds.includes(String(application.id)));
      if (!shouldUpdate) return;
      const tieBreakerPoints = validateTieBreakerPoints(patch?.tieBreakerPoints ?? application?.screening?.tieBreakerPoints ?? 0);
      const criteriaId = patch?.tieBreakerCriteriaId === undefined
        ? (savedCriteria ? Number(savedCriteria.id) : (application?.screening?.tieBreakerCriteriaId ? toInt(application.screening.tieBreakerCriteriaId) : null))
        : toInt(patch.tieBreakerCriteriaId);
      const finalScore = calculateFinalScreeningScore(application?.screening?.screeningScore || 0, tieBreakerPoints);
      db.prepare(`
        UPDATE career_screening_applicants
        SET tie_breaker_criteria_id = ?,
            tie_breaker_points = ?,
            final_score = ?,
            tie_breaker_reviewed = 1,
            updated_at = ?
        WHERE application_id = ?
      `).run(criteriaId, tieBreakerPoints, finalScore, timestamp, applicationId);
    });

    const rerankedWorkspace = buildPositionScreeningWorkspace(postingId);
    const rerankedApplicants = sortScreeningApplicantsByScore(rerankedWorkspace.applicants, direction, "finalScore");
    rerankedApplicants.forEach((application, index) => {
      db.prepare(`
        UPDATE career_screening_applicants
        SET sort_order = ?,
            updated_at = ?
        WHERE application_id = ?
      `).run(index + 1, timestamp, Number(application.id));
    });

    db.prepare(`
      UPDATE career_screenings
      SET rankings_json = ?,
          tie_breaker_enabled = 1,
          ranking_needs_refresh = 0,
          updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(rerankedApplicants.map((application) => String(application.id))), timestamp, screeningId);
  });

  transaction();
  return buildPositionScreeningWorkspace(postingId);
};

const saveScreeningTieBreaker = (applicationId, data = {}) => {
  const applicantId = toInt(applicationId);
  if (!applicantId) throw new Error("Application is required.");
  const application = getAdminApplication(applicantId);
  if (!application) throw new Error("Application not found.");
  const screeningId = ensurePositionScreeningRow(application.positionId);
  const screeningRow = db.prepare("SELECT criteria_json FROM career_screenings WHERE id = ?").get(screeningId);
  const criteria = parseJson(screeningRow?.criteria_json, []);
  const existing = db.prepare("SELECT * FROM career_screening_applicants WHERE application_id = ?").get(applicantId);
  if (!existing) throw new Error("Application has not been saved in screening yet.");
  const tieBreakerCriteriaId = data.tieBreakerCriteriaId === undefined || data.tieBreakerCriteriaId === null || data.tieBreakerCriteriaId === ""
    ? (existing.tie_breaker_criteria_id === null || existing.tie_breaker_criteria_id === undefined ? null : Number(existing.tie_breaker_criteria_id))
    : toInt(data.tieBreakerCriteriaId);
  if (tieBreakerCriteriaId) {
    const criterion = db.prepare("SELECT * FROM career_screening_tie_breaker_criteria WHERE id = ?").get(tieBreakerCriteriaId);
    if (!criterion) throw new Error("Tie-breaker criteria not found.");
  }
  const tieBreakerPoints = validateTieBreakerPoints(data.tieBreakerPoints);

  const scores = parseJson(existing.scores_json, {});
  const metrics = calculateScreeningMetrics(scores, criteria);
  const screeningScore = Number.isFinite(Number(existing.screening_score)) ? Number(existing.screening_score) : metrics.screeningScore;
  const finalScore = calculateFinalScreeningScore(screeningScore, tieBreakerPoints);
  const reviewed = data.reviewed === undefined ? true : parseBool(data.reviewed);
  const timestamp = nowIso();

  db.prepare(`
    UPDATE career_screening_applicants
    SET screening_score = ?,
        tie_breaker_criteria_id = ?,
        tie_breaker_points = ?,
        final_score = ?,
        tie_breaker_reviewed = ?,
        updated_at = ?
    WHERE application_id = ?
  `).run(screeningScore, tieBreakerCriteriaId, tieBreakerPoints, finalScore, boolInt(reviewed), timestamp, applicantId);

  db.prepare(`
    UPDATE career_screenings
    SET tie_breaker_enabled = 1,
        ranking_needs_refresh = 1,
        updated_at = ?
    WHERE id = ?
  `).run(timestamp, screeningId);

  return {
    application: getAdminApplication(applicantId),
    screening: mapScreeningForApplicant(applicantId),
    workspace: buildPositionScreeningWorkspace(application.positionId)
  };
};

const createTalentPoolEntryFromApplication = (applicationRow) => {
  const talent = createTalentPoolSubmission({
    fullName: applicationRow.full_name,
    email: applicationRow.email,
    phone: applicationRow.phone,
    currentLocation: applicationRow.current_location,
    yearsExperience: applicationRow.years_experience,
    desiredRoles: applicationRow.job_title || "Talent Pool Candidate",
    industries: applicationRow.company_name || "",
    summary: `Moved from screening for ${applicationRow.job_title || "position"} on ${nowIso().slice(0, 10)}.`,
    sourcePath: applicationRow.source_path,
    ipAddress: applicationRow.ip_address,
    userAgent: applicationRow.user_agent
  });

  if (applicationRow.cv_file_id || applicationRow.cover_letter_file_id) {
    db.prepare(`
      UPDATE career_talent_pool_submissions
      SET cv_file_id = COALESCE(cv_file_id, ?),
          cover_letter_file_id = COALESCE(cover_letter_file_id, ?),
          updated_at = ?
      WHERE id = ?
    `).run(applicationRow.cv_file_id || null, applicationRow.cover_letter_file_id || null, nowIso(), Number(talent.id));
  }

  return getAdminTalentPoolEntry(Number(talent.id));
};

const pushScreeningApplicantsToShortlist = ({
  positionId,
  shortlistedApplicationIds = [],
  nonShortlistedAction,
  tieBreakers = [],
  decidedBy = ""
} = {}) => {
  const postingId = toInt(positionId);
  if (!postingId) throw new Error("Position ID is required.");
  const action = cleanText(nonShortlistedAction).toLowerCase();
  if (!NON_SHORTLISTED_ACTIONS.has(action)) {
    throw new Error("A valid non-shortlisted action is required.");
  }
  const ids = [...new Set((Array.isArray(shortlistedApplicationIds) ? shortlistedApplicationIds : []).map((id) => toInt(id)).filter(Boolean))];
  if (!ids.length) throw new Error("Select at least one applicant to shortlist.");

  const workspace = buildPositionScreeningWorkspace(postingId);
  if (!workspace.applicants.length) throw new Error("No applicants available for this screening.");
  if (!workspace.screening?.lastSortedAt) throw new Error("Sort applicants by score before pushing to shortlist.");
  if (!workspace.applicants.every((application) => application.screeningReady)) throw new Error("All applicants must be fully scored before pushing to shortlist.");
  if (workspace.unresolvedTieGroups.length) throw new Error("Resolve all tie scores before pushing to shortlist.");

  const applicantIds = new Set(workspace.applicants.map((application) => Number(application.id)));
  if (ids.some((id) => !applicantIds.has(id))) {
    throw new Error("One or more selected applicants do not belong to this position.");
  }

  const blockedStatuses = new Set(["shortlisted", "interview", "offer", "hired", "rejected", "closed", "deleted"]);
  const tieBreakerMap = new Map(
    (Array.isArray(tieBreakers) ? tieBreakers : [])
      .map((item) => [toInt(item?.applicationId), item])
      .filter(([applicationId]) => applicationId)
  );
  const timestamp = nowIso();
  const pushed = [];
  const moved = [];
  const skipped = [];
  const errors = [];
  const talentPoolEntries = [];

  const transaction = db.transaction(() => {
    workspace.applicants.forEach((application) => {
      const applicationId = Number(application.id);
      const row = db.prepare(`
        SELECT a.*, p.title AS job_title, p.company_name, sa.id AS screening_result_id, sa.screening_score,
               sa.tie_breaker_points, sa.final_score, sa.tie_breaker_reviewed
        FROM career_job_applications a
        JOIN career_job_postings p ON p.id = a.job_posting_id
        LEFT JOIN career_screening_applicants sa ON sa.application_id = a.id
        WHERE a.id = ?
      `).get(applicationId);
      if (!row || Number(row.job_posting_id) !== postingId) {
        errors.push({ applicationId: String(applicationId), error: "Application does not belong to selected position." });
        return;
      }

      const currentStatus = normalizeApplicationStatus(row.status, "applied");
      if (blockedStatuses.has(currentStatus) && currentStatus !== "shortlisted") {
        skipped.push({ applicationId: String(applicationId), reason: `Already in ${currentStatus} stage.` });
        return;
      }

      const tieBreakerPatch = tieBreakerMap.get(applicationId);
      const tieBreakerPoints = tieBreakerPatch
        ? validateTieBreakerPoints(tieBreakerPatch.tieBreakerPoints)
        : validateTieBreakerPoints(row.tie_breaker_points || 0);
      if (!Number.isFinite(tieBreakerPoints)) {
        errors.push({ applicationId: String(applicationId), error: "Tie-breaker score must be numeric." });
        return;
      }

      const screeningScore = Number(row.screening_score || application?.screening?.screeningScore || 0);
      const finalScore = calculateFinalScreeningScore(screeningScore, tieBreakerPoints);
      const isShortlisted = ids.includes(applicationId);
      const shortlistDecision = isShortlisted ? "shortlisted" : action;

      db.prepare(`
        UPDATE career_screening_applicants
        SET screening_score = ?,
            tie_breaker_points = ?,
            final_score = ?,
            tie_breaker_reviewed = 1,
            shortlist_decision = ?,
            shortlist_decided_at = ?,
            shortlist_decided_by = ?,
            updated_at = ?
        WHERE application_id = ?
      `).run(screeningScore, tieBreakerPoints, finalScore, shortlistDecision, timestamp, cleanText(decidedBy), timestamp, applicationId);

      if (isShortlisted) {
        db.prepare(`
          INSERT INTO shortlisted_applicants (
            application_id, applicant_id, position_id, screening_result_id, shortlisting_criteria_id,
            shortlist_score, shortlist_reason, pushed_by, pushed_at, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 'active', ?, ?)
          ON CONFLICT(application_id, position_id) DO UPDATE SET
            screening_result_id = excluded.screening_result_id,
            shortlisting_criteria_id = excluded.shortlisting_criteria_id,
            shortlist_score = excluded.shortlist_score,
            shortlist_reason = excluded.shortlist_reason,
            pushed_by = excluded.pushed_by,
            pushed_at = excluded.pushed_at,
            status = 'active',
            updated_at = excluded.updated_at
        `).run(
          applicationId,
          row.applicant_id || applicationId,
          postingId,
          row.screening_result_id || null,
          finalScore,
          "Pushed from screening shortlist workflow",
          cleanText(decidedBy),
          timestamp,
          timestamp,
          timestamp
        );

        db.prepare(`
          UPDATE career_job_applications
          SET status = 'shortlisted', updated_at = ?
          WHERE id = ?
        `).run(timestamp, applicationId);
        pushed.push({ applicationId: String(applicationId), finalScore });
        return;
      }

      if (action === "deleted") {
        db.prepare(`
          UPDATE career_job_applications
          SET status = 'deleted', updated_at = ?
          WHERE id = ?
        `).run(timestamp, applicationId);
        db.prepare(`
          UPDATE shortlisted_applicants
          SET status = 'inactive', updated_at = ?
          WHERE application_id = ?
        `).run(timestamp, applicationId);
      } else if (action === "talent_pool") {
        const talent = createTalentPoolEntryFromApplication(row);
        talentPoolEntries.push(talent);
        db.prepare(`
          UPDATE career_job_applications
          SET status = 'talent_pool', updated_at = ?
          WHERE id = ?
        `).run(timestamp, applicationId);
      } else {
        db.prepare(`
          UPDATE career_job_applications
          SET status = ?, updated_at = ?
          WHERE id = ?
        `).run(action, timestamp, applicationId);
      }

      db.prepare(`
        UPDATE shortlisted_applicants
        SET status = 'inactive', updated_at = ?
        WHERE application_id = ?
      `).run(timestamp, applicationId);
      moved.push({ applicationId: String(applicationId), action, finalScore });
    });
  });

  transaction();

  const actionSummary = moved.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {});
  const summaryParts = [`${pushed.length} applicant${pushed.length === 1 ? "" : "s"} pushed to Shortlist`];
  if (actionSummary.talent_pool) summaryParts.push(`${actionSummary.talent_pool} moved to Talent Pool`);
  if (actionSummary.not_shortlisted) summaryParts.push(`${actionSummary.not_shortlisted} marked Not Shortlisted`);
  if (actionSummary.rejected) summaryParts.push(`${actionSummary.rejected} marked Rejected`);
  if (actionSummary.deleted) summaryParts.push(`${actionSummary.deleted} removed from active records`);
  const message = `${summaryParts.join(", ")}.`;

  createDashboardNotification({
    title: "Shortlist updated successfully",
    detail: message,
    tone: "success",
    relatedType: "screening",
    relatedId: postingId
  });

  return {
    position: getJobPosting(postingId),
    shortlistedApplicants: pushed,
    nonShortlistedApplicants: moved,
    skipped,
    errors,
    talentPoolEntries,
    applicants: listApplications().filter((application) => String(application.positionId) === String(postingId)),
    workspace: buildPositionScreeningWorkspace(postingId),
    message
  };
};

const pushPositionApplicantsToScreening = (positionId, options = {}) => {
  const postingId = toInt(positionId);
  if (!postingId) {
    throw new Error("A valid position is required.");
  }

  const posting = db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(postingId);
  if (!posting) {
    throw new Error("Position not found.");
  }

  const screeningEligibleStatuses = new Set(["new", "screening"]);
  const preferredOrder = Array.isArray(options.applicantOrder)
    ? options.applicantOrder.map((id) => String(id))
    : [];
  const filtrationOrder = preferredOrder.length
    ? preferredOrder
    : (mapScreeningForPosition(postingId)?.rankings || []);
  const filtrationOrderMap = new Map(filtrationOrder.map((id, index) => [String(id), index]));
  const applicants = db.prepare(`
    SELECT *
    FROM career_job_applications
    WHERE job_posting_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(postingId);

  const eligibleApplicants = applicants
    .filter((applicant) => screeningEligibleStatuses.has(cleanText(applicant.status).toLowerCase()))
    .sort((left, right) => {
      const leftOrder = filtrationOrderMap.has(String(left.id)) ? filtrationOrderMap.get(String(left.id)) : Number.MAX_SAFE_INTEGER;
      const rightOrder = filtrationOrderMap.has(String(right.id)) ? filtrationOrderMap.get(String(right.id)) : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

  if (!eligibleApplicants.length) {
    throw new Error("No applicants connected to this position are ready to push to screening.");
  }

  const pushedAt = nowIso();
  const rankings = eligibleApplicants.map((applicant) => String(applicant.id));

  const transaction = db.transaction(() => {
    let screeningId = db.prepare(`
      SELECT id
      FROM career_screenings
      WHERE job_posting_id = ?
    `).get(postingId)?.id;

    if (!screeningId) {
      const insert = db.prepare(`
        INSERT INTO career_screenings (
          job_posting_id, criteria_json, rankings_json, pushed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(postingId, JSON.stringify([]), JSON.stringify(rankings), pushedAt, pushedAt, pushedAt);
      screeningId = Number(insert.lastInsertRowid);
    } else {
      const currentCriteria = db.prepare(`
        SELECT criteria_json
        FROM career_screenings
        WHERE id = ?
      `).get(screeningId)?.criteria_json || JSON.stringify([]);
      db.prepare(`
        UPDATE career_screenings
        SET criteria_json = ?, rankings_json = ?, pushed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(currentCriteria, JSON.stringify(rankings), pushedAt, pushedAt, screeningId);
    }

    eligibleApplicants.forEach((applicant) => {
      const existing = db.prepare(`
        SELECT *
        FROM career_screening_applicants
        WHERE application_id = ?
      `).get(applicant.id);

      if (existing) {
        db.prepare(`
          UPDATE career_screening_applicants
          SET screening_id = ?, updated_at = ?
          WHERE application_id = ?
        `).run(screeningId, pushedAt, applicant.id);
      } else {
        db.prepare(`
          INSERT INTO career_screening_applicants (
            screening_id, application_id, screening_status, scores_json, ai_json, report_json, created_at, updated_at
          ) VALUES (?, ?, 'not-started', ?, ?, ?, ?, ?)
        `).run(
          screeningId,
          applicant.id,
          JSON.stringify({}),
          "null",
          JSON.stringify({ content: "", recommendation: "" }),
          pushedAt,
          pushedAt
        );
      }

      db.prepare(`
        UPDATE career_job_applications
        SET status = 'screening', updated_at = ?
        WHERE id = ?
      `).run(pushedAt, applicant.id);
    });

    db.prepare(`
      UPDATE career_job_postings
      SET status = 'screening', closed_at = COALESCE(closed_at, ?), updated_at = ?
      WHERE id = ?
    `).run(pushedAt, pushedAt, postingId);
  });

  transaction();

  return {
    position: getJobPosting(postingId),
    applicants: rankings.map((applicationId) => getAdminApplication(Number(applicationId))).filter(Boolean),
    screening: mapScreeningForPosition(postingId)
  };
};

const deleteApplication = (id) => {
  const transaction = db.transaction((applicationId) => deleteApplicationRecord(applicationId));
  return transaction(id);
};

const getAdminTalentPoolEntry = (id) => {
  const row = db.prepare("SELECT * FROM career_talent_pool_submissions WHERE id = ?").get(id);
  if (!row) return null;
  const files = getFileMetaMap([row.cv_file_id, row.cover_letter_file_id]);
  const cvFile = row.cv_file_id ? (files.get(row.cv_file_id) || null) : null;
  const coverLetterFile = row.cover_letter_file_id ? (files.get(row.cover_letter_file_id) || null) : null;
  const applicant = row.applicant_id ? getApplicantById(row.applicant_id) : null;
  const fullName = applicant?.fullName || row.full_name;
  const email = applicant?.email || row.email;
  return {
    id: String(row.id),
    applicantId: applicant?.id || (row.applicant_id ? String(row.applicant_id) : String(row.id)),
    userId: applicant?.id || (row.applicant_id ? String(row.applicant_id) : String(row.id)),
    submissionCode: row.submission_code,
    fullName,
    name: fullName,
    title: row.desired_roles || "Talent Pool Candidate",
    location: row.current_location || "",
    yearsExperience: toInt(row.years_experience, 0),
    yearsExperienceLabel: row.years_experience || "",
    status: row.status === "new" ? "open-to-work" : row.status,
    headline: row.summary || "Joined the Heya Talent Solutions talent pool.",
    email,
    normalizedEmail: applicant?.normalizedEmail || row.normalized_email || normalizeEmail(row.email),
    phone: applicant?.phone || row.phone,
    languages: [],
    education: row.highest_qualification || "",
    skills: splitCsv(row.key_skills || row.industries),
    pastRoles: [],
    lastTouchpoint: row.updated_at || row.created_at,
    source: "Talent Pool",
    notes: row.summary || "",
    desiredRoles: row.desired_roles || "",
    industries: row.industries || "",
    preferredWorkLocation: row.preferred_work_location || "",
    highestQualification: row.highest_qualification || "",
    keySkills: row.key_skills || "",
    availability: row.availability || "",
    cvLink: row.cv_link || "",
    coverLetterLink: row.cover_letter_link || "",
    coverLetterText: row.cover_letter_text || "",
    additionalNotes: row.additional_notes || "",
    cvFile,
    coverLetterFile,
    cvName: cvFile?.name || "",
    coverLetterName: coverLetterFile?.name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    lastContactedAt: row.last_contacted_at || null,
    consentExpiresAt: row.consent_expires_at || null
  };
};

const listTalentPoolEntries = ({ limit = null } = {}) => {
  const rows = db.prepare(`
  SELECT *
  FROM career_talent_pool_submissions
  ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
  ${Number.isInteger(limit) && limit > 0 ? `LIMIT ${Math.min(limit, 500)}` : ""}
`).all();
  const fileMap = getFileMetaMap(rows.flatMap((row) => [row.cv_file_id, row.cover_letter_file_id, row.id_photo_file_id]));
  return rows.map((row) => ({
    id: String(row.id),
    applicantId: row.applicant_id ? String(row.applicant_id) : String(row.id),
    userId: row.applicant_id ? String(row.applicant_id) : String(row.id),
    submissionCode: row.submission_code,
    fullName: row.full_name,
    name: row.full_name,
    title: row.desired_roles || "Talent Pool Candidate",
    location: row.current_location || "",
    yearsExperience: toInt(row.years_experience, 0),
    yearsExperienceLabel: row.years_experience || "",
    status: row.status === "new" ? "open-to-work" : row.status,
    headline: row.summary || "Joined the Heya Talent Solutions talent pool.",
    email: row.email,
    normalizedEmail: row.normalized_email || normalizeEmail(row.email),
    phone: row.phone,
    languages: [],
    education: row.highest_qualification || "",
    skills: splitCsv(row.key_skills || row.industries),
    pastRoles: [],
    lastTouchpoint: row.updated_at || row.created_at,
    source: "Talent Pool",
    notes: row.summary || "",
    desiredRoles: row.desired_roles || "",
    industries: row.industries || "",
    preferredWorkLocation: row.preferred_work_location || "",
    highestQualification: row.highest_qualification || "",
    keySkills: row.key_skills || "",
    availability: row.availability || "",
    cvLink: row.cv_link || "",
    coverLetterLink: row.cover_letter_link || "",
    coverLetterText: row.cover_letter_text || "",
    additionalNotes: row.additional_notes || "",
    cvFile: row.cv_file_id ? (fileMap.get(row.cv_file_id) || null) : null,
    coverLetterFile: row.cover_letter_file_id ? (fileMap.get(row.cover_letter_file_id) || null) : null,
    cvName: row.cv_file_id ? (fileMap.get(row.cv_file_id)?.name || "") : "",
    coverLetterName: row.cover_letter_file_id ? (fileMap.get(row.cover_letter_file_id)?.name || "") : "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    lastContactedAt: row.last_contacted_at || null,
    consentExpiresAt: row.consent_expires_at || null
  }));
};

const listTalentPoolEntriesSince = (since) => {
  const normalizedSince = parseSince(since);
  if (!normalizedSince) return [];
  const rows = db.prepare(`
    SELECT *
    FROM career_talent_pool_submissions
    WHERE datetime(COALESCE(updated_at, created_at)) > datetime(?)
    ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
  `).all(normalizedSince);
  const fileMap = getFileMetaMap(rows.flatMap((row) => [row.cv_file_id, row.cover_letter_file_id, row.id_photo_file_id]));
  return rows.map((row) => ({
    id: String(row.id),
    applicantId: row.applicant_id ? String(row.applicant_id) : String(row.id),
    userId: row.applicant_id ? String(row.applicant_id) : String(row.id),
    submissionCode: row.submission_code,
    fullName: row.full_name,
    name: row.full_name,
    title: row.desired_roles || "Talent Pool Candidate",
    location: row.current_location || "",
    yearsExperience: toInt(row.years_experience, 0),
    yearsExperienceLabel: row.years_experience || "",
    status: row.status === "new" ? "open-to-work" : row.status,
    headline: row.summary || "Joined the Heya Talent Solutions talent pool.",
    email: row.email,
    normalizedEmail: row.normalized_email || normalizeEmail(row.email),
    phone: row.phone,
    languages: [],
    education: row.highest_qualification || "",
    skills: splitCsv(row.key_skills || row.industries),
    pastRoles: [],
    lastTouchpoint: row.updated_at || row.created_at,
    source: "Talent Pool",
    notes: row.summary || "",
    desiredRoles: row.desired_roles || "",
    industries: row.industries || "",
    preferredWorkLocation: row.preferred_work_location || "",
    highestQualification: row.highest_qualification || "",
    keySkills: row.key_skills || "",
    availability: row.availability || "",
    cvLink: row.cv_link || "",
    coverLetterLink: row.cover_letter_link || "",
    coverLetterText: row.cover_letter_text || "",
    additionalNotes: row.additional_notes || "",
    cvFile: row.cv_file_id ? (fileMap.get(row.cv_file_id) || null) : null,
    coverLetterFile: row.cover_letter_file_id ? (fileMap.get(row.cover_letter_file_id) || null) : null,
    cvName: row.cv_file_id ? (fileMap.get(row.cv_file_id)?.name || "") : "",
    coverLetterName: row.cover_letter_file_id ? (fileMap.get(row.cover_letter_file_id)?.name || "") : "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    lastContactedAt: row.last_contacted_at || null,
    consentExpiresAt: row.consent_expires_at || null
  }));
};

const getLatestTalentPoolTimestamp = () => {
  const row = db.prepare(`
    SELECT COALESCE(updated_at, created_at) AS latest_timestamp
    FROM career_talent_pool_submissions
    ORDER BY datetime(COALESCE(updated_at, created_at)) DESC, id DESC
    LIMIT 1
  `).get();
  return row?.latest_timestamp || null;
};

const updateTalentPoolProfile = (id, data = {}) => {
  const current = db.prepare("SELECT * FROM career_talent_pool_submissions WHERE id = ?").get(id);
  if (!current) return null;
  const applicant = ensureApplicantIdentity({
    applicantId: current.applicant_id,
    fullName: data.name ?? data.fullName ?? current.full_name,
    email: data.email ?? current.email,
    normalizedEmail: normalizeEmail(data.email ?? current.email),
    phone: data.phone ?? current.phone
  });
  /* resolve tags — accept array or comma-string from UI */
  let resolvedTags = current.tags || null;
  if (data.tags !== undefined) {
    const rawTags = Array.isArray(data.tags)
      ? data.tags
      : String(data.tags || "").split(",");
    resolvedTags = rawTags.map((t) => t.trim()).filter(Boolean).join(",") || null;
  }

  db.prepare(`
    UPDATE career_talent_pool_submissions
    SET applicant_id = ?,
        full_name = ?,
        normalized_email = ?,
        email = ?,
        phone = ?,
        current_location = ?,
        years_experience = ?,
        desired_roles = ?,
        industries = ?,
        summary = ?,
        tags = ?,
        consent_expires_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    Number(applicant.id),
    applicant.fullName,
    applicant.normalizedEmail,
    applicant.email,
    applicant.phone,
    cleanText(data.location ?? data.currentLocation ?? current.current_location),
    cleanText(data.yearsExperienceLabel ?? data.yearsExperience ?? current.years_experience),
    cleanText(data.title ?? data.desiredRoles ?? current.desired_roles),
    Array.isArray(data.skills) ? data.skills.join(", ") : cleanText(data.skills ?? data.industries ?? current.industries),
    cleanMultiline(data.headline ?? data.notes ?? data.summary ?? current.summary),
    resolvedTags,
    cleanText(data.consentExpiresAt ?? data.consent_expires_at ?? current.consent_expires_at),
    nowIso(),
    id
  );
  return getAdminTalentPoolEntry(id);
};

const deleteTalentPoolEntryRecord = (id) => {
  const row = db.prepare("SELECT * FROM career_talent_pool_submissions WHERE id = ?").get(id);
  if (!row) return null;
  const current = getAdminTalentPoolEntry(id);

  if (row.cv_file_id) deleteCareerFileRecord(row.cv_file_id);
  if (row.cover_letter_file_id) deleteCareerFileRecord(row.cover_letter_file_id);

  db.prepare("UPDATE career_messages SET linked_talent_pool_submission_id = NULL, updated_at = ? WHERE linked_talent_pool_submission_id = ?")
    .run(nowIso(), id);
  db.prepare("DELETE FROM career_talent_pool_submissions WHERE id = ?").run(id);
  deleteNotificationsFor("talent-pool", id);
  return current;
};

const deleteTalentPoolEntry = (id) => {
  const transaction = db.transaction((talentId) => deleteTalentPoolEntryRecord(talentId));
  return transaction(id);
};

const bulkDeleteTalentPoolEntries = (ids = []) => {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => toInt(id)).filter(Boolean))];
  const transaction = db.transaction((talentIds) => talentIds
    .map((id) => deleteTalentPoolEntryRecord(id))
    .filter(Boolean));
  return transaction(uniqueIds);
};

const messageKindFor = (data = {}) => {
  const raw = cleanText(data.kind || data.type || data.careerIntent || data.serviceNeeded).toLowerCase();
  if (raw.includes("job-application") || raw.includes("job application") || raw === "application") {
    return "job-application";
  }
  if (raw.includes("jobseeker-cv") || raw.includes("cv-submission") || raw.includes("cv submission") || raw === "cv") {
    return "cv-submission";
  }
  if (data.jobPostingId || data.positionId) return "job-application";
  if (data.cvUpload || data.cvFileId || data.cvFile?.id) return "cv-submission";
  return "general";
};

const messageStatusFor = (status) => {
  const next = cleanText(status).toLowerCase();
  return ["unread", "read", "archived"].includes(next) ? next : "unread";
};

const messageSubjectFor = (data = {}, kind = "general") => {
  const subject = cleanText(data.subject);
  if (subject) return subject;
  if (data.positionTitle) return `Application for ${cleanText(data.positionTitle)}`;
  if (kind === "job-application") return "Job application / CV submission";
  if (kind === "cv-submission") return "Talent pool CV submission";
  return cleanText(data.serviceNeeded) || "New contact message";
};

const createInboxMessage = (data = {}) => {
  const now = nowIso();
  const kind = messageKindFor(data);
  const positionId = toInt(data.positionId || data.jobPostingId);
  const posting = positionId ? db.prepare("SELECT * FROM career_job_postings WHERE id = ?").get(positionId) : null;
  const linkedApplicationId = toInt(data.linkedApplicationId);
  const linkedTalentId = toInt(data.linkedTalentPoolSubmissionId || data.linkedTalentId);
  const linkedApplicantId = toInt(data.linkedApplicantId)
    || toInt(data.applicantId)
    || toInt(linkedApplicationId ? db.prepare("SELECT applicant_id FROM career_job_applications WHERE id = ?").get(linkedApplicationId)?.applicant_id : null)
    || toInt(linkedTalentId ? db.prepare("SELECT applicant_id FROM career_talent_pool_submissions WHERE id = ?").get(linkedTalentId)?.applicant_id : null);
  const inferredApplicantId = linkedApplicantId
    || toInt((["job-application", "cv-submission"].includes(kind) && normalizeEmail(data.email))
      ? findApplicantRowByNormalizedEmail(data.email)?.id
      : null);
  const result = db.prepare(`
    INSERT INTO career_messages (
      kind, status, full_name, email, phone, subject, body, service_needed,
      current_location, years_experience, desired_roles, industries,
      position_id, position_title, cv_file_id, cover_letter_file_id,
      linked_talent_pool_submission_id, linked_applicant_id, linked_application_id,
      source_path, ip_address, user_agent, received_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    kind,
    messageStatusFor(data.status),
    cleanText(data.fullName || data.name),
    cleanText(data.email).toLowerCase(),
    cleanText(data.phone),
    messageSubjectFor({ ...data, positionTitle: data.positionTitle || posting?.title }, kind),
    cleanMultiline(data.message || data.body || data.summary || data.coverLetterText),
    cleanText(data.serviceNeeded),
    cleanText(data.currentLocation),
    cleanText(data.yearsExperience),
    cleanText(data.desiredRoles),
    cleanText(data.industries),
    positionId,
    cleanText(data.positionTitle || posting?.title),
    toInt(data.cvFileId || data.cvFile?.id),
    toInt(data.coverLetterFileId || data.coverLetterFile?.id),
    linkedTalentId,
    inferredApplicantId,
    linkedApplicationId,
    cleanText(data.sourcePath),
    cleanText(data.ipAddress),
    cleanText(data.userAgent),
    data.receivedAt || now,
    now,
    now
  );

  const messageId = Number(result.lastInsertRowid);
  let cvFileId = toInt(data.cvFileId || data.cvFile?.id);
  let coverLetterFileId = toInt(data.coverLetterFileId || data.coverLetterFile?.id);

  if (!cvFileId && data.cvUpload) {
    cvFileId = saveCareerFile({ ownerType: "message", ownerId: messageId, fieldName: "cv", upload: data.cvUpload });
  }
  if (!coverLetterFileId && data.coverLetterUpload) {
    coverLetterFileId = saveCareerFile({ ownerType: "message", ownerId: messageId, fieldName: "cover-letter", upload: data.coverLetterUpload });
  }

  if (cvFileId || coverLetterFileId) {
    db.prepare(`
      UPDATE career_messages
      SET cv_file_id = ?, cover_letter_file_id = ?, updated_at = ?
      WHERE id = ?
    `).run(cvFileId, coverLetterFileId, nowIso(), messageId);
  }

  const message = getAdminMessage(messageId);
  createDashboardNotification({
    type: "message",
    title: message.isApplication ? "Application message received" : "Message received",
    detail: `${message.name} sent ${message.subject || "a dashboard message"}.`,
    tone: message.isApplication ? "urgent" : "info",
    relatedType: "message",
    relatedId: message.id,
    createdAt: message.receivedAt
  });

  return message;
};

const getAdminMessage = (id) => {
  const row = db.prepare("SELECT * FROM career_messages WHERE id = ?").get(id);
  if (!row) return null;
  const cvFile = fileMeta(row.cv_file_id);
  const coverLetterFile = fileMeta(row.cover_letter_file_id);
  const position = row.position_id ? getJobPosting(row.position_id) : null;
  const talent = row.linked_talent_pool_submission_id ? getAdminTalentPoolEntry(row.linked_talent_pool_submission_id) : null;
  const application = row.linked_application_id ? getAdminApplication(row.linked_application_id) : null;
  const applicant = row.linked_applicant_id
    ? getApplicantById(row.linked_applicant_id)
    : application?.applicantId
      ? getApplicantById(application.applicantId)
      : talent?.applicantId
        ? getApplicantById(talent.applicantId)
        : null;

  return {
    id: String(row.id),
    kind: row.kind,
    status: row.status,
    isApplication: row.kind === "job-application" || row.kind === "cv-submission",
    name: row.full_name,
    email: row.email || "",
    phone: row.phone || "",
    subject: row.subject || "",
    body: row.body || "",
    serviceNeeded: row.service_needed || "",
    currentLocation: row.current_location || "",
    yearsExperience: row.years_experience || "",
    desiredRoles: row.desired_roles || "",
    industries: row.industries || "",
    positionId: row.position_id ? String(row.position_id) : null,
    positionTitle: row.position_title || position?.title || "",
    cvName: cvFile?.name || "",
    coverLetterName: coverLetterFile?.name || "",
    cvFile,
    coverLetterFile,
    linkedApplicationId: row.linked_application_id ? String(row.linked_application_id) : null,
    linkedTalentId: row.linked_talent_pool_submission_id ? String(row.linked_talent_pool_submission_id) : null,
    linkedApplicantId: applicant?.id || (row.linked_applicant_id ? String(row.linked_applicant_id) : null),
    linkedTalent: talent ? { id: talent.id, name: talent.name, status: talent.status } : null,
    linkedApplicant: applicant ? {
      id: applicant.id,
      applicantId: applicant.id,
      name: applicant.name,
      email: applicant.email,
      status: application?.status || talent?.status || ""
    } : null,
    linkedApplication: application ? {
      id: application.id,
      applicationId: application.applicationId,
      applicantId: application.applicantId,
      name: application.name,
      status: application.status,
      positionTitle: application.positionTitle
    } : null,
    linkedPosition: position ? { id: position.id, title: position.title, status: position.status } : null,
    sourcePath: row.source_path || "",
    receivedAt: row.received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const listInboxMessages = ({ status = "all", kind = "all", limit = 100 } = {}) => {
  const clauses = [];
  const params = [];
  if (status !== "all") {
    clauses.push("status = ?");
    params.push(messageStatusFor(status));
  }
  if (kind !== "all") {
    clauses.push("kind = ?");
    params.push(messageKindFor({ kind }));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`
    SELECT id
    FROM career_messages
    ${where}
    ORDER BY received_at DESC, id DESC
    LIMIT ?
  `).all(...params, Math.min(toInt(limit, 100) || 100, 500)).map((row) => getAdminMessage(row.id));
};

const getInboxSummary = () => {
  const rows = db.prepare("SELECT kind, status FROM career_messages").all();
  return {
    total: rows.length,
    unread: rows.filter((row) => row.status === "unread").length,
    archived: rows.filter((row) => row.status === "archived").length,
    applications: rows.filter((row) => row.kind === "job-application" || row.kind === "cv-submission").length,
    byKind: rows.reduce((acc, row) => {
      acc[row.kind] = (acc[row.kind] || 0) + 1;
      return acc;
    }, {})
  };
};

const getUnreadInboxMessageCount = () => {
  const row = db.prepare(`
    SELECT COUNT(*) AS unread
    FROM career_messages
    WHERE status = 'unread'
  `).get();
  return Number(row?.unread || 0);
};

const listRecentInboxMessages = ({ limit = 8 } = {}) => {
  return listInboxMessages({ limit: Math.min(toInt(limit, 8) || 8, 25) });
};

const getLatestInboxMessageTimestamp = () => {
  const row = db.prepare(`
    SELECT COALESCE(updated_at, received_at, created_at) AS latest_timestamp
    FROM career_messages
    ORDER BY datetime(COALESCE(updated_at, received_at, created_at)) DESC, id DESC
    LIMIT 1
  `).get();
  return row?.latest_timestamp || null;
};

const setMessageStatus = (id, status) => {
  const nextStatus = messageStatusFor(status);
  db.prepare(`
    UPDATE career_messages
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(nextStatus, nowIso(), id);
  return getAdminMessage(id);
};

const addMessageToTalentPool = (id, data = {}) => {
  const message = getAdminMessage(id);
  if (!message) return null;

  let talent = message.linkedTalentId ? getAdminTalentPoolEntry(Number(message.linkedTalentId)) : null;
  if (!talent) {
    talent = createTalentPoolSubmission({
      fullName: message.name,
      email: message.email,
      phone: message.phone,
      currentLocation: cleanText(data.currentLocation || data.location || message.currentLocation),
      yearsExperience: cleanText(data.yearsExperience || message.yearsExperience),
      desiredRoles: cleanText(data.desiredRoles || data.title || message.desiredRoles || message.subject),
      industries: cleanText(data.industries || data.skills || message.industries),
      message: cleanMultiline(data.notes || message.body),
      sourcePath: message.sourcePath
    });

    db.prepare(`
      UPDATE career_talent_pool_submissions
      SET cv_file_id = COALESCE(cv_file_id, ?),
          cover_letter_file_id = COALESCE(cover_letter_file_id, ?),
          updated_at = ?
      WHERE id = ?
    `).run(
      toInt(message.cvFile?.id),
      toInt(message.coverLetterFile?.id),
      nowIso(),
      Number(talent.id)
    );
    talent = getAdminTalentPoolEntry(Number(talent.id));
  }

  db.prepare(`
    UPDATE career_messages
    SET status = 'read', linked_talent_pool_submission_id = ?, linked_applicant_id = ?, updated_at = ?
    WHERE id = ?
  `).run(Number(talent.id), toInt(talent.applicantId), nowIso(), id);

  return { message: getAdminMessage(id), talent };
};

const attachMessageToJob = (id, jobPostingId, data = {}) => {
  const message = getAdminMessage(id);
  if (!message) return null;
  const position = getJobPosting(jobPostingId);
  if (!position) {
    throw new Error("Job advert not found.");
  }
  if (position.status !== "published") {
    throw new Error("Applications can only be attached to published job adverts.");
  }

  let application = message.linkedApplicationId ? getAdminApplication(Number(message.linkedApplicationId)) : null;
  if (!application) {
    application = createJobApplication(Number(position.id), {
      fullName: message.name,
      email: message.email,
      phone: message.phone,
      currentLocation: cleanText(data.currentLocation || message.currentLocation),
      yearsExperience: cleanText(data.yearsExperience || message.yearsExperience),
      message: cleanMultiline(data.notes || message.body),
      sourcePath: message.sourcePath
    });

    db.prepare(`
      UPDATE career_job_applications
      SET cv_file_id = COALESCE(cv_file_id, ?),
          cover_letter_file_id = COALESCE(cover_letter_file_id, ?),
          updated_at = ?
      WHERE id = ?
    `).run(
      toInt(message.cvFile?.id),
      toInt(message.coverLetterFile?.id),
      nowIso(),
      Number(application.id)
    );
    application = getAdminApplication(Number(application.id));
  } else if (application.positionId !== String(position.id)) {
    db.prepare(`
      UPDATE career_job_applications
      SET job_posting_id = ?, updated_at = ?
      WHERE id = ?
    `).run(Number(position.id), nowIso(), Number(application.id));
    application = getAdminApplication(Number(application.id));
  }

  db.prepare(`
    UPDATE career_messages
    SET status = 'read',
        position_id = ?,
        position_title = ?,
        linked_applicant_id = ?,
        linked_application_id = ?,
        updated_at = ?
    WHERE id = ?
  `).run(Number(position.id), position.title, toInt(application.applicantId), Number(application.id), nowIso(), id);

  return { message: getAdminMessage(id), application, position };
};

const getPublicJobBoardData = () => {
  const jobs = listJobPostingRows("WHERE p.status = 'published'").map(mapPostingRow);
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const filters = {
    industries: ["All Industries", ...unique(jobs.map((job) => job.industry))],
    locations: ["All Locations", ...unique(jobs.map((job) => job.location))],
    types: ["All Types", ...unique(jobs.map((job) => job.type))],
    levels: ["All Levels", ...unique(jobs.map((job) => job.level))]
  };
  const talentPoolCount = db.prepare("SELECT COUNT(*) AS count FROM career_talent_pool_submissions").get().count;
  const applicationCount = db.prepare("SELECT COUNT(*) AS count FROM career_job_applications").get().count;
  const employerSubmissionCount = db.prepare("SELECT COUNT(*) AS count FROM career_employer_submissions").get().count;

  return {
    jobs,
    filters,
    stats: {
      jobCount: jobs.length,
      sectorCount: unique(jobs.map((job) => job.industry)).length,
      locationCount: unique(jobs.map((job) => job.location)).length,
      featuredCount: jobs.filter((job) => job.featured).length,
      urgentCount: jobs.filter((job) => job.urgent).length,
      talentPoolCount,
      applicationCount,
      employerSubmissionCount
    }
  };
};

const getDashboardData = ({
  includeNotifications = true,
  notificationsLimit = 50,
  applicationsLimit = null,
  employerSubmissionsLimit = null,
  talentPoolLimit = null
} = {}) => ({
  positions: listJobPostingRows().map(mapPostingRow),
  applicants: listApplications({ limit: applicationsLimit }),
  talentPool: listTalentPoolEntries({ limit: talentPoolLimit }),
  employerSubmissions: listEmployerSubmissions({ limit: employerSubmissionsLimit }),
  notifications: includeNotifications ? listDashboardNotifications({ limit: notificationsLimit }) : [],
  notificationSummary: getDashboardNotificationSummary(),
  latestTimestamps: {
    notifications: getLatestDashboardNotificationTimestamp(),
    messages: getLatestInboxMessageTimestamp(),
    employerSubmissions: getLatestEmployerSubmissionTimestamp(),
    applications: getLatestApplicationTimestamp(),
    talentPool: getLatestTalentPoolTimestamp()
  },
  stats: getPublicJobBoardData().stats
});

const savePositionFiltration = (positionId, filtrationData) => {
  db.prepare("UPDATE career_job_postings SET filtration_json = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(filtrationData), nowIso(), positionId);
  return getJobPosting(positionId);
};

const listApplicationsForPosition = (positionId) => {
  const rows = db.prepare(`
    ${applicationSelectSql}
    WHERE a.job_posting_id = ?
      AND lower(a.status) NOT IN ('deleted', 'rejected', 'closed', 'not_shortlisted')
  `).all(positionId);
  const fileIds = rows.flatMap(r => [r.cv_file_id, r.cover_letter_file_id, r.id_photo_file_id].filter(Boolean));
  const fileMap = fileIds.length ? getFileMetaMap(fileIds) : new Map();
  return rows.map(r => mapApplicationRow(r, fileMap));
};

const getAllFilesForApplication = (applicationId) => {
  return db.prepare("SELECT * FROM career_files WHERE owner_type = 'job-application' AND owner_id = ?").all(applicationId);
};

/* ── Stage history reader ─────────────────────────────────────────────────── */
const listApplicationStageHistory = (applicationId) => {
  const rows = db.prepare(`
    SELECT * FROM career_application_stage_history
    WHERE application_id = ?
    ORDER BY changed_at ASC, id ASC
  `).all(Number(applicationId));
  return rows.map((row) => ({
    id:            String(row.id),
    applicationId: String(row.application_id),
    fromStage:     row.from_stage || null,
    toStage:       row.to_stage,
    changedBy:     row.changed_by || "admin",
    reason:        row.reason || "",
    notes:         row.notes || "",
    changedAt:     row.changed_at
  }));
};

/* ── Rejection reasons reader ─────────────────────────────────────────────── */
const listRejectionReasons = ({ activeOnly = true } = {}) => {
  const rows = db.prepare(
    activeOnly
      ? "SELECT * FROM career_rejection_reasons WHERE is_active = 1 ORDER BY id"
      : "SELECT * FROM career_rejection_reasons ORDER BY id"
  ).all();
  return rows.map((row) => ({
    id:          String(row.id),
    code:        row.code,
    description: row.description,
    isActive:    Boolean(row.is_active)
  }));
};

/* ── Offers reader (from career_offers table) ─────────────────────────────── */
const listOfferRecords = ({ applicationId = null, status = null } = {}) => {
  let sql = "SELECT o.*, a.full_name, a.email, a.job_posting_id FROM career_offers o JOIN career_job_applications a ON a.id = o.application_id";
  const params = [];
  const where = [];
  if (applicationId) { where.push("o.application_id = ?"); params.push(Number(applicationId)); }
  if (status)        { where.push("o.offer_status = ?");   params.push(status); }
  if (where.length)  sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY o.updated_at DESC, o.id DESC";
  return db.prepare(sql).all(...params).map((row) => ({
    id:              String(row.id),
    applicationId:   String(row.application_id),
    offerStatus:     row.offer_status,
    salaryNotes:     row.salary_notes || "",
    proposedStart:   row.proposed_start || null,
    issuedAt:        row.issued_at || null,
    expiresAt:       row.expires_at || null,
    respondedAt:     row.responded_at || null,
    rejectionReason: row.rejection_reason || "",
    notes:           row.notes || "",
    history:         parseJson(row.history_json, []),
    createdBy:       row.created_by || "admin",
    createdAt:       row.created_at,
    updatedAt:       row.updated_at
  }));
};

/* ── Duplicate / email history (Item 9) ─────────────────────────────────── */
const getApplicationEmailHistory = (normalizedEmail, excludeApplicationId) => {
  return db.prepare(`
    SELECT
      a.id, a.application_code, a.full_name, a.email, a.status,
      a.created_at, a.updated_at,
      p.id   AS position_id,
      p.title AS position_title
    FROM career_job_applications a
    LEFT JOIN career_job_postings p ON p.id = a.job_posting_id
    WHERE a.normalized_email = ?
      AND a.id != ?
    ORDER BY a.created_at DESC
  `).all(
    String(normalizedEmail || "").toLowerCase().trim(),
    Number(excludeApplicationId) || 0
  );
};

const getDuplicateSummary = () => {
  const row = db.prepare(`
    SELECT COUNT(*) AS duplicate_count
    FROM (
      SELECT normalized_email
      FROM career_job_applications
      WHERE normalized_email IS NOT NULL AND normalized_email != ''
      GROUP BY normalized_email
      HAVING COUNT(*) > 1
    )
  `).get();
  return { duplicateEmailCount: row?.duplicate_count || 0 };
};

/* ── Reporting metrics (Item 10) ─────────────────────────────────────────── */
const getReportingMetrics = () => {
  /* time-to-hire per position */
  const hireRows = db.prepare(`
    SELECT
      COALESCE(p.title, 'Unknown position') AS position_title,
      COUNT(*)                              AS hired_count,
      ROUND(AVG(julianday(a.updated_at) - julianday(a.created_at)), 1) AS avg_days
    FROM career_job_applications a
    LEFT JOIN career_job_postings p ON p.id = a.job_posting_id
    WHERE lower(a.status) = 'hired'
      AND a.created_at IS NOT NULL AND a.updated_at IS NOT NULL
    GROUP BY a.job_posting_id
    ORDER BY avg_days ASC
  `).all();

  const avgDaysOverall = hireRows.length
    ? Math.round(hireRows.reduce((s, r) => s + (r.avg_days || 0), 0) / hireRows.length)
    : null;

  /* stage funnel */
  const stageRows = db.prepare(`
    SELECT lower(status) AS stage, COUNT(*) AS count
    FROM career_job_applications
    WHERE lower(status) NOT IN ('deleted')
    GROUP BY lower(status)
  `).all();
  const stageMap = Object.fromEntries(stageRows.map((r) => [r.stage, r.count]));
  const MAIN_FUNNEL = ["new", "screening", "shortlisted", "interview", "offer", "hired"];
  const funnelWithConversion = MAIN_FUNNEL.map((stage, idx) => {
    const count = stageMap[stage] || 0;
    const prev  = idx > 0 ? (stageMap[MAIN_FUNNEL[idx - 1]] || 0) : null;
    return { stage, count, conversionPct: (prev && prev > 0) ? Math.round((count / prev) * 100) : null };
  });

  /* rejection reasons */
  const rejectionRows = db.prepare(`
    SELECT
      COALESCE(rr.description, 'No reason recorded') AS reason,
      COUNT(*) AS count
    FROM career_job_applications a
    LEFT JOIN career_rejection_reasons rr ON rr.id = a.rejection_reason_id
    WHERE lower(a.status) = 'rejected'
    GROUP BY rr.id
    ORDER BY count DESC
  `).all();

  /* offer acceptance */
  const offerStats = db.prepare(`
    SELECT
      COUNT(*)  AS total,
      SUM(CASE WHEN lower(offer_status) IN ('accepted','closed') THEN 1 ELSE 0 END) AS accepted,
      SUM(CASE WHEN lower(offer_status) = 'rejected'             THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN lower(offer_status) = 'pending'              THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN lower(offer_status) = 'expired'              THEN 1 ELSE 0 END) AS expired
    FROM career_offers
  `).get() || {};

  return {
    timeToHire: { avgDaysOverall, perPosition: hireRows },
    stageFunnel: funnelWithConversion,
    rejectionBreakdown: rejectionRows,
    offerAcceptance: {
      total:    offerStats.total    || 0,
      accepted: offerStats.accepted || 0,
      rejected: offerStats.rejected || 0,
      pending:  offerStats.pending  || 0,
      expired:  offerStats.expired  || 0,
      rate: offerStats.total > 0
        ? Math.round(((offerStats.accepted || 0) / offerStats.total) * 100)
        : null
    }
  };
};

/* ── Talent pool active tools (Item 8) ───────────────────────────────────── */
const updateTalentPoolTags = (id, tags) => {
  const tagString = Array.isArray(tags)
    ? tags.map((t) => String(t).trim()).filter(Boolean).join(",")
    : String(tags || "").trim();
  return db.prepare(`
    UPDATE career_talent_pool_submissions
    SET tags = ?, updated_at = ?
    WHERE id = ?
  `).run(tagString || null, nowIso(), Number(id));
};

const markTalentPoolContacted = (id) => {
  return db.prepare(`
    UPDATE career_talent_pool_submissions
    SET last_contacted_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nowIso(), nowIso(), Number(id));
};

/* ── File verification ────────────────────────────────────────────────────── */
const getApplicationFilesWithVerification = (applicationId) => {
  return db.prepare(`
    SELECT id, owner_id, owner_type, field_name AS fieldName, original_name AS originalName,
           stored_name AS storedName, mime_type AS mimeType, size_bytes AS sizeBytes,
           relative_path AS relativePath, created_at AS createdAt,
           verification_status AS verificationStatus, verified_by AS verifiedBy,
           verified_at AS verifiedAt, verification_notes AS verificationNotes
    FROM career_files
    WHERE owner_type = 'job-application' AND owner_id = ?
    ORDER BY id ASC
  `).all(Number(applicationId));
};

const updateFileVerification = (fileId, { verificationStatus = "pending_review", verifiedBy = "admin", verificationNotes = "" } = {}) => {
  const now = nowIso();
  return db.prepare(`
    UPDATE career_files
    SET verification_status  = ?,
        verified_by          = ?,
        verified_at          = ?,
        verification_notes   = ?
    WHERE id = ?
  `).run(verificationStatus, verifiedBy, now, verificationNotes || "", Number(fileId));
};

/* ── Rejection reason writer ─────────────────────────────────────────────── */
const setApplicationRejectionReason = (applicationId, { rejectionReasonId = null, rejectionNotes = "" } = {}) => {
  const ts = nowIso();
  return db.prepare(`
    UPDATE career_job_applications
    SET rejection_reason_id = ?,
        rejection_notes     = ?,
        updated_at          = ?
    WHERE id = ?
  `).run(rejectionReasonId ? Number(rejectionReasonId) : null, rejectionNotes || "", ts, String(applicationId));
};

export const careersDb = {
  maxUploadBytes,
  createEmployerSubmission,
  createJobApplication,
  createTalentPoolSubmission,
  listEmployerSubmissions,
  getEmployerSubmission,
  deleteEmployerSubmission,
  bulkDeleteEmployerSubmissions,
  createJobPosting,
  updateJobPosting,
  setJobPostingStatus,
  deleteJobPosting,
  getJobPosting,
  getPublicJobBoardData,
  getDashboardData,
  listOffers,
  updateOfferStatus,
  softDeleteOffers,
  updateApplicationStatus,
  saveApplicationShortlistReview,
  listPositionScreenings,
  listScreeningTieBreakerCriteria: listTieBreakerCriteria,
  getScreeningTieBreakerCriteria,
  createScreeningTieBreakerCriteria,
  updateScreeningTieBreakerCriteria,
  sortPositionScreeningApplicants,
  sortPositionScreeningApplicantsWithTieBreaker,
  saveScreeningTieBreaker,
  listShortlistingCriteria,
  createShortlistingCriteria,
  runPositionShortlisting,
  pushScreeningApplicantsToShortlist,
  pushToShortlist,
  listShortlistedApplicants,
  moveShortlistedToInterview,
  getShortlistedChecklist,
  saveShortlistedChecklist,
  saveApplicationScreening,
  pushPositionApplicantsToScreening,
  updatePositionKpiCriteria,
  getApplication: getAdminApplication,
  listApplications,
  deleteApplication,
  updateTalentPoolProfile,
  listTalentPoolEntries,
  deleteTalentPoolEntry,
  bulkDeleteTalentPoolEntries,
  convertEmployerSubmissionToDraft,
  getCareerFileById,
  setJobPostingImage,
  getPublicJobImage,
  createInboxMessage,
  listInboxMessages,
  getInboxSummary,
  getAdminMessage,
  setMessageStatus,
  addMessageToTalentPool,
  attachMessageToJob,
  createDashboardNotification,
  listDashboardNotifications,
  getDashboardNotificationSummary,
  getUnreadDashboardNotificationCount,
  listRecentDashboardNotifications,
  getLatestDashboardNotificationTimestamp,
  markDashboardNotificationRead,
  deleteDashboardNotification,
  listEmployerSubmissionsSince,
  getLatestEmployerSubmissionTimestamp,
  listApplicationsSince,
  getLatestApplicationTimestamp,
  listTalentPoolEntriesSince,
  getLatestTalentPoolTimestamp,
  getUnreadInboxMessageCount,
  listRecentInboxMessages,
  getLatestInboxMessageTimestamp,
  savePositionFiltration,
  listApplicationsForPosition,
  getAllFilesForApplication,
  integrityCheck,
  listApplicationStageHistory,
  listRejectionReasons,
  listOfferRecords,
  getApplicationFilesWithVerification,
  updateFileVerification,
  setApplicationRejectionReason,
  getApplicationEmailHistory,
  getDuplicateSummary,
  getReportingMetrics,
  updateTalentPoolTags,
  markTalentPoolContacted,
  storePdApplicationIds,
  storePdJobPostingIds,
  getJobPostingPdIds,
  createManualApplication,
  updateApplicantPhone
};

export default careersDb;
