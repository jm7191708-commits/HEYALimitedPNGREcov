"use strict";
const pptxgen = require("pptxgenjs");

// ── Brand colours ──────────────────────────────────────────────────────────────
const BG_DARK  = "12172a";
const BG_CARD  = "1c2340";
const GREEN    = "3ddc5f";
const GREEN_DK = "1f6b35";
const WHITE    = "ffffff";
const MUTED    = "a8b4c0";
const BG_MID   = "181d30";

// ── Font faces ─────────────────────────────────────────────────────────────────
const F_TITLE = "Arial Black";
const F_BODY  = "Calibri";

// ── Helpers ────────────────────────────────────────────────────────────────────
const RR = "roundRect";
const RECT = "rect";
const OVAL = "ellipse";

function dot(slide, x, y, color, size) {
  size = size || 0.18;
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: size, h: size,
    fill: { color },
    line: { color, width: 0 }
  });
}

function card(slide, x, y, w, h, opts) {
  opts = opts || {};
  slide.addShape(opts.rounded !== false ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: opts.fill || BG_CARD },
    line: { color: opts.border || GREEN, width: opts.bw || 1.5 },
    rectRadius: opts.rounded !== false ? 0.08 : undefined
  });
}

function txt(slide, text, x, y, w, h, opts) {
  opts = opts || {};
  slide.addText(text, {
    x, y, w, h,
    color: opts.color || WHITE,
    fontSize: opts.size || 12,
    fontFace: opts.font || F_BODY,
    bold: opts.bold || false,
    italic: opts.italic || false,
    align: opts.align || "left",
    valign: opts.valign || "middle",
    margin: opts.margin !== undefined ? opts.margin : 3,
    wrap: true
  });
}

function arrow(slide, x, y, w) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: w || 0.5, h: 0.07,
    fill: { color: GREEN },
    line: { color: GREEN, width: 0 }
  });
}

// ── Create presentation ────────────────────────────────────────────────────────
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author  = "Glondia Analysts & Consultancy";
pres.title   = "HEYA Limited — Full-Stack Recruitment Platform";

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  // Decorative ellipses
  s.addShape(pres.shapes.OVAL, { x: -1.5, y: -1.5, w: 5, h: 5, fill: { color: GREEN_DK, transparency: 30 }, line: { color: GREEN_DK, width: 0 } });
  s.addShape(pres.shapes.OVAL, { x: 11,   y: 5,    w: 4, h: 4, fill: { color: GREEN_DK, transparency: 30 }, line: { color: GREEN_DK, width: 0 } });
  s.addShape(pres.shapes.OVAL, { x: 12,   y: 3.5,  w: 1.2, h: 1.2, fill: { color: GREEN, transparency: 40 }, line: { color: GREEN, width: 0 } });

  txt(s, "GLONDIA",                        0, 1.8,  13.33, 0.4,  { color: GREEN,  size: 14, bold: true,  font: F_TITLE, align: "center" });
  txt(s, "ANALYSTS & CONSULTANCY",         0, 2.25, 13.33, 0.35, { color: MUTED,  size: 10, font: F_BODY,  align: "center" });
  txt(s, "HEYA Limited",                   0, 3.0,  13.33, 0.9,  { color: WHITE,  size: 44, bold: true,  font: F_TITLE, align: "center" });
  txt(s, "Full-Stack Recruitment Platform",0, 3.95, 13.33, 0.5,  { color: GREEN,  size: 20, font: F_BODY,  align: "center" });

  // Thin green line
  s.addShape(pres.shapes.RECTANGLE, { x: 4.5, y: 4.55, w: 4.33, h: 0.03, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });

  txt(s, "Your Personal Business Partner", 0, 4.65, 13.33, 0.4,  { color: MUTED,  size: 13, italic: true, font: F_BODY, align: "center" });
  txt(s, "2024–2025",                       0, 6.8,  13.33, 0.3,  { color: MUTED,  size: 10, font: F_BODY, align: "center" });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Project Overview
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "What We Delivered",                        0.5, 0.4, 8, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "A complete, production-ready recruitment ecosystem", 0.5, 1.1, 8, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const bullets = [
    "Public-facing careers portal with job listings & applications",
    "Employer direct-submission portal",
    "AI-powered admin recruitment dashboard (11 tabs)",
    "RoxanneAI — built-in AI assistant with MCP integrations",
    "RESTful backend API (Node.js/Express) — 80+ routes",
    "SQLite database with 8 core tables & file management"
  ];

  bullets.forEach((b, i) => {
    const y = 1.6 + i * 0.55;
    dot(s, 0.5, y + 0.05, GREEN);
    txt(s, b, 0.85, y, 6.5, 0.45, { color: WHITE, size: 13, font: F_BODY, valign: "middle" });
  });

  // Stat cards
  const statCards = [
    { num: "80+", label: "API Routes",        y: 1.5  },
    { num: "11",  label: "Dashboard Tabs",    y: 2.75 },
    { num: "8",   label: "AI Eval Criteria",  y: 4.0  },
    { num: "6",   label: "Pipeline Stages",   y: 5.25 }
  ];

  statCards.forEach(sc => {
    card(s, 8.5, sc.y, 4.3, 1.1, { fill: BG_CARD, border: GREEN, bw: 1.5 });
    txt(s, sc.num,   8.5, sc.y + 0.05, 4.3, 0.55, { color: GREEN, size: 32, bold: true, font: F_TITLE, align: "center" });
    txt(s, sc.label, 8.5, sc.y + 0.6,  4.3, 0.38, { color: MUTED, size: 11, font: F_BODY, align: "center" });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — System Architecture
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "System Architecture", 0.5, 0.3, 12, 0.7, { color: WHITE, size: 36, bold: true, font: F_TITLE });

  // Tier boxes
  const tiers = [
    { label: "USERS",       x: 0.4,  items: ["Job Seekers","Employers","Admins"], aiItem: "RoxanneAI" },
    { label: "APPLICATION", x: 4.1,  items: ["Public Website","Admin Dashboard","React Frontend","Session Auth"] },
    { label: "BACKEND",     x: 8.2,  items: ["Express.js API","SQLite Database"], aiItem: "OpenAI API", extraItem: "MCP Server" }
  ];

  tiers.forEach((tier, ti) => {
    const tw = ti === 0 ? 2.8 : 3.2;
    card(s, tier.x, 1.4, tw, 3.8, { fill: BG_CARD, border: GREEN, bw: 1.5, rounded: false });
    txt(s, tier.label, tier.x, 1.5, tw, 0.4, { color: GREEN, size: 11, bold: true, font: F_TITLE, align: "center" });

    const allItems = [...tier.items];
    if (tier.aiItem && ti === 0)   allItems.push(tier.aiItem);
    if (tier.aiItem && ti === 2)   allItems.push(tier.aiItem);
    if (tier.extraItem)            allItems.push(tier.extraItem);

    allItems.forEach((item, ii) => {
      const iy   = 2.0 + ii * 0.65;
      const isFull = (item === "RoxanneAI" || item === "OpenAI API");
      const ibg  = isFull ? GREEN_DK : BG_DARK;
      const ic   = isFull ? GREEN : WHITE;
      const ib   = isFull ? GREEN : GREEN_DK;
      s.addShape(pres.shapes.RECTANGLE, {
        x: tier.x + 0.15, y: iy, w: tw - 0.3, h: 0.52,
        fill: { color: ibg }, line: { color: ib, width: 1 }
      });
      txt(s, item, tier.x + 0.15, iy, tw - 0.3, 0.52, { color: ic, size: 11, font: F_BODY, align: "center" });
    });
  });

  // Arrows
  arrow(s, 3.3,  3.1, 0.7);
  arrow(s, 7.4,  3.1, 0.7);

  txt(s, "HTTP/HTTPS", 3.2,  3.22, 0.9, 0.25, { color: MUTED, size: 9, font: F_BODY, align: "center" });
  txt(s, "REST API",   7.3,  3.22, 0.9, 0.25, { color: MUTED, size: 9, font: F_BODY, align: "center" });

  txt(s, "Node.js · SQLite · OpenAI Responses API · Archiver · Multer · Express-session", 0.5, 5.6, 12.33, 0.3, { color: MUTED, size: 10, font: F_BODY, align: "center" });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Careers Portal
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Careers Portal",                          0.5, 0.35, 7, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "What job seekers experience end-to-end",  0.5, 1.05, 7, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const features = [
    { n:"1", head:"Live Job Listings",       detail:"Searchable, filterable position cards with salary, location & role details" },
    { n:"2", head:"Detailed Job Pages",      detail:"Full description, requirements and a prominent Apply CTA" },
    { n:"3", head:"Multi-File Application Form", detail:"CV, cover letter, ID photo, community doc — all uploaded & stored securely" },
    { n:"4", head:"Instant Confirmation",    detail:"Applicants receive on-screen confirmation; admin is notified in real time" }
  ];

  features.forEach((f, i) => {
    const y = 1.55 + i * 0.85;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: y + 0.02, w: 0.32, h: 0.32, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });
    txt(s, f.n,      0.5,  y + 0.02, 0.32, 0.32, { color: BG_DARK, size: 10, bold: true, font: F_BODY, align: "center" });
    txt(s, f.head,   0.95, y,        6.5,  0.33, { color: WHITE, size: 14, bold: true, font: F_TITLE });
    txt(s, f.detail, 0.95, y + 0.3,  6.5,  0.48, { color: MUTED, size: 12, font: F_BODY });
  });

  // Right mock panel
  card(s, 7.8, 1.0, 5.0, 5.5, { fill: BG_CARD, border: GREEN, bw: 1, rounded: false });
  txt(s, "Job Listings", 7.9, 1.1, 4.8, 0.38, { color: MUTED, size: 10, font: F_BODY, bold: true, align: "center" });

  const mockJobs = [
    "Software Engineer · Auckland · Full-time",
    "Recruitment Officer · Wellington · Contract",
    "Operations Manager · Christchurch · Perm"
  ];

  mockJobs.forEach((job, i) => {
    const jy = 1.6 + i * 0.85;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.0, y: jy, w: 4.5, h: 0.7, fill: { color: BG_DARK }, line: { color: GREEN_DK, width: 0.75 }, rectRadius: 0.05 });
    dot(s, 8.15, jy + 0.26, GREEN, 0.15);
    txt(s, job, 8.4, jy, 3.9, 0.7, { color: WHITE, size: 10, font: F_BODY, valign: "middle" });
  });

  // Apply Now button
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.5, y: 4.2, w: 1.8, h: 0.45, fill: { color: GREEN }, line: { color: GREEN, width: 0 }, rectRadius: 0.07 });
  txt(s, "Apply Now", 9.5, 4.2, 1.8, 0.45, { color: BG_DARK, size: 11, bold: true, font: F_BODY, align: "center" });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Employer Submission Portal
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Employer Submission Portal",                           0.5, 0.35, 12, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "Employers submit hiring briefs directly — no account needed", 0.5, 1.05, 12, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const steps = [
    { num:"01", x:0.4,  title:"Employer Submits Brief",       body:"Company details, role requirements, headcount, location, salary range & supporting files" },
    { num:"02", x:4.6,  title:"Auto-Queued in Dashboard",     body:"Submission lands in the Employer Submissions tab — admin reviews, notes & converts to a draft position" },
    { num:"03", x:8.8,  title:"Position Goes Live",           body:"Admin publishes the position — it appears on the public careers portal immediately" }
  ];

  steps.forEach(st => {
    card(s, st.x, 1.6, 3.8, 2.8, { fill: BG_CARD, border: GREEN, bw: 1.5 });
    txt(s, st.num,   st.x, 1.85, 3.8, 0.55, { color: GREEN, size: 28, bold: true, font: F_TITLE, align: "center" });
    txt(s, st.title, st.x, 2.45, 3.8, 0.45, { color: WHITE, size: 14, bold: true, font: F_BODY,  align: "center" });
    txt(s, st.body,  st.x, 2.95, 3.8, 1.3,  { color: MUTED, size: 11, font: F_BODY,  align: "center" });
  });

  // Arrows between step boxes
  arrow(s, 4.3, 3.07, 0.25);
  arrow(s, 8.5, 3.07, 0.25);

  // Bottom fields bar
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 5.0, w: 12.5, h: 1.1, fill: { color: BG_CARD }, line: { color: GREEN_DK, width: 1 } });
  txt(s, "Fields captured:", 0.6, 5.1, 1.6, 0.35, { color: GREEN, size: 11, bold: true, font: F_BODY });

  const tags = ["Company Name","Role Title","Headcount","Salary Range","Location","Supporting Files"];
  tags.forEach((tag, i) => {
    const tx = 2.35 + i * 1.75;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: 5.18, w: 1.6, h: 0.35, fill: { color: BG_DARK }, line: { color: GREEN, width: 0.75 }, rectRadius: 0.05 });
    txt(s, tag, tx, 5.18, 1.6, 0.35, { color: WHITE, size: 9, font: F_BODY, align: "center" });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Admin Dashboard Overview
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Admin Dashboard",                                                     0.5, 0.35, 8, 0.7,  { color: WHITE, size: 38, bold: true, font: F_TITLE });
  txt(s, "A complete recruitment command centre — role-authenticated, real-time",0.5, 1.1,  8, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const features = [
    "Session-based authentication — secure admin access with redirect-on-logout",
    "Real-time auto-refresh — new applications & submissions appear without page reload",
    "Notification engine — badge counts, recent alerts, mark-read & delete",
    "Role-aware display — UI adapts based on logged-in admin role"
  ];

  features.forEach((f, i) => {
    const y = 1.6 + i * 0.8;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: y + 0.05, w: 0.3, h: 0.3, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });
    txt(s, "✓", 0.5, y + 0.05, 0.3, 0.3, { color: BG_DARK, size: 10, bold: true, font: F_BODY, align: "center" });
    txt(s, f, 0.95, y, 5.8, 0.65, { color: WHITE, size: 13, font: F_BODY, valign: "middle" });
  });

  // 3×4 tab grid
  const tabs = [
    "Overview","Positions","Applications",
    "Screenings","Shortlisted","Offers",
    "Talent Pool","Messages","Notifications",
    "RoxanneAI","Settings","Employer Sub."
  ];

  tabs.forEach((tab, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const tx = 7.0 + col * 2.05;
    const ty = 1.3 + row * 0.95;
    card(s, tx, ty, 1.9, 0.82, { fill: BG_CARD, border: GREEN, bw: 1 });
    txt(s, tab, tx, ty, 1.9, 0.82, { color: WHITE, size: 10, bold: true, font: F_TITLE, align: "center" });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Positions & Applications
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Positions & Applications", 0.5, 0.3, 12, 0.65, { color: WHITE, size: 34, bold: true, font: F_TITLE });

  // Position lifecycle label
  txt(s, "POSITION LIFECYCLE", 0.5, 1.1, 5, 0.3, { color: GREEN, size: 10, bold: true, font: F_BODY });

  const stages = [
    { x: 0.4,  label: "Draft",        sub: "Created by admin",     ai: false },
    { x: 3.1,  label: "Open",         sub: "Live on careers portal",ai: false },
    { x: 5.8,  label: "Under Review", sub: "AI filter run",         ai: false },
    { x: 8.5,  label: "Shortlisting", sub: "Candidates ranked",     ai: false },
    { x: 11.2, label: "Closed",       sub: "Hired / archived",      ai: true  }
  ];

  stages.forEach((st, i) => {
    const fill = st.ai ? GREEN_DK : BG_CARD;
    card(s, st.x, 1.4, 2.2, 0.9, { fill, border: GREEN, bw: 1 });
    txt(s, st.label, st.x, 1.45, 2.2, 0.45, { color: WHITE, size: 13, bold: true, font: F_BODY, align: "center" });
    txt(s, st.sub,   st.x, 1.9,  2.2, 0.33, { color: MUTED, size: 10, font: F_BODY, align: "center" });
    if (i < stages.length - 1) arrow(s, st.x + 2.22, 1.8, 0.32);
  });

  // Application management
  txt(s, "APPLICATION MANAGEMENT", 0.5, 2.75, 5, 0.3, { color: GREEN, size: 10, bold: true, font: F_BODY });

  const cards3 = [
    { x: 0.4,  title: "Document Viewer",   tc: WHITE,  border: GREEN,    items: ["CV, cover letter, ID photo","Community/tabonetta doc","Download individual files","Full ZIP export per position"] },
    { x: 4.67, title: "Status Management", tc: WHITE,  border: GREEN_DK, items: ["Pending → Reviewed → Shortlisted","Batch status updates","Delete with full file cleanup","Orphan-safe DB cascade"] },
    { x: 8.94, title: "AI Filter",         tc: GREEN,  border: GREEN,    items: ["One-click AI evaluation","8-criteria document check","Automatic score & ranking","Results saved to database"] }
  ];

  cards3.forEach(c3 => {
    card(s, c3.x, 3.05, 4.0, 3.2, { fill: BG_CARD, border: c3.border, bw: 1.5, rounded: false });
    txt(s, c3.title, c3.x + 0.15, 3.1,  3.7, 0.42, { color: c3.tc, size: 15, bold: true, font: F_TITLE });
    c3.items.forEach((item, ii) => {
      txt(s, "· " + item, c3.x + 0.15, 3.62 + ii * 0.55, 3.7, 0.48, { color: MUTED, size: 11, font: F_BODY });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — AI Recruitment Filter
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "AI Recruitment Filter",                                                         0.5, 0.3,  12, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "OpenAI evaluates every applicant's documents against 8 defined criteria",       0.5, 1.05, 12, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const criteria = [
    "CV / Résumé present",
    "Profile photo attached",
    "Cover letter included",
    "Tabonetta / community document",
    "Employer reference provided",
    "Relevant skills & experience",
    "Qualifications verified",
    "Document completeness score"
  ];

  criteria.forEach((c, i) => {
    const cy = 1.6 + i * 0.42;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: cy, w: 0.28, h: 0.28, fill: { color: GREEN_DK }, line: { color: GREEN, width: 1 } });
    txt(s, "✓", 0.5, cy, 0.28, 0.28, { color: GREEN, size: 9, bold: true, font: F_BODY, align: "center" });
    txt(s, c, 0.88, cy, 5.8, 0.38, { color: WHITE, size: 13, font: F_BODY, valign: "middle" });
  });

  // Score card
  card(s, 7.2, 1.3, 5.6, 5.0, { fill: BG_CARD, border: GREEN, bw: 2 });
  txt(s, "SAMPLE SCORECARD",                    7.2, 1.5,  5.6, 0.3,  { color: MUTED, size: 9, bold: true, font: F_BODY, align: "center" });
  txt(s, "J. Thompson",                          7.2, 1.9,  5.6, 0.38, { color: WHITE, size: 16, bold: true, font: F_BODY,  align: "center" });
  txt(s, "7 / 8",                                7.2, 2.35, 5.6, 0.85, { color: GREEN, size: 52, bold: true, font: F_TITLE, align: "center" });
  txt(s, "AI Completeness Score",                7.2, 3.25, 5.6, 0.3,  { color: MUTED, size: 10, font: F_BODY, align: "center" });

  // Progress bar
  s.addShape(pres.shapes.RECTANGLE, { x: 7.7, y: 3.65, w: 4.6, h: 0.22, fill: { color: BG_DARK }, line: { color: BG_DARK, width: 0 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 7.7, y: 3.65, w: 4.025, h: 0.22, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });

  txt(s, "Ranked #1 of 24 applicants",           7.2, 4.05, 5.6, 0.33, { color: GREEN, size: 11, bold: true, font: F_BODY, align: "center" });
  txt(s, "Summary: Strong candidate — all core documents present, relevant experience confirmed.", 7.2, 4.42, 5.6, 0.55, { color: MUTED, size: 10, italic: true, font: F_BODY, align: "center" });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Screening & Shortlisting
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Screening & Shortlisting Pipeline", 0.5, 0.3, 12, 0.65, { color: WHITE, size: 34, bold: true, font: F_TITLE });

  const flow = [
    { x: 0.4,  title: "Screening Queue",   sub: "AI-ranked applicants await manual review",    fill: BG_CARD },
    { x: 3.5,  title: "Manual Scoring",    sub: "Recruiter scores each criterion manually",     fill: BG_CARD },
    { x: 6.6,  title: "Tie-Breaking",      sub: "Automated tie-breaker resolves equal scores",  fill: BG_CARD },
    { x: 9.7,  title: "Shortlisted",       sub: "Top candidates advance to interview",          fill: GREEN_DK }
  ];

  flow.forEach((f, i) => {
    card(s, f.x, 1.1, 2.8, 0.95, { fill: f.fill, border: GREEN, bw: 1.5, rounded: false });
    txt(s, f.title, f.x, 1.15, 2.8, 0.42, { color: WHITE, size: 13, bold: true, font: F_BODY, align: "center" });
    txt(s, f.sub,   f.x, 1.58, 2.8, 0.42, { color: MUTED, size: 10, font: F_BODY, align: "center" });
    if (i < flow.length - 1) arrow(s, f.x + 2.83, 1.52, 0.3);
  });

  // Bottom 2 column cards
  const botCards = [
    {
      x: 0.4, title: "Tie-Breaker System", tc: GREEN,
      items: [
        "Create named tie-breaker criteria per position",
        "Score individual applicants against each criterion",
        "System auto-resolves ties and re-ranks",
        "Full audit trail of scoring decisions"
      ],
      border: GREEN
    },
    {
      x: 6.8, title: "Shortlist Workflow", tc: GREEN,
      items: [
        "Push selected candidates to shortlist in bulk",
        "Shortlist checklist per candidate (custom criteria)",
        "One-click move to interview stage",
        "Offer tracking after interview decision"
      ],
      border: GREEN_DK
    }
  ];

  botCards.forEach(bc => {
    card(s, bc.x, 2.5, 6.1, 3.8, { fill: BG_CARD, border: bc.border, bw: 1.5, rounded: false });
    txt(s, bc.title, bc.x + 0.2, 2.65, 5.7, 0.45, { color: bc.tc, size: 16, bold: true, font: F_TITLE });
    bc.items.forEach((item, ii) => {
      txt(s, "· " + item, bc.x + 0.2, 3.22 + ii * 0.6, 5.7, 0.52, { color: MUTED, size: 12, font: F_BODY });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Talent Pool
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Talent Pool Management",                                      0.5, 0.35, 9, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "Maintain a live pipeline of candidates independent of active positions", 0.5, 1.05, 9, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const features = [
    { head: "Manual Profile Creation", body: "Recruiters add talent directly via a full-form modal — personal details, professional summary, location, skills" },
    { head: "Document Uploads",        body: "CV and cover letter attached at profile level — stored securely with file references in DB" },
    { head: "Pipeline Integration",    body: "Talent pool profiles can be attached to active positions or converted to applicants" },
    { head: "Bulk Management",         body: "Select multiple profiles, bulk delete, search and filter across the full pool" }
  ];

  features.forEach((f, i) => {
    const fy = 1.6 + i * 0.9;
    dot(s, 0.5, fy + 0.08, GREEN, 0.2);
    txt(s, f.head, 0.85, fy,      6.5, 0.38, { color: WHITE, size: 14, bold: true, font: F_BODY });
    txt(s, f.body, 0.85, fy + 0.35, 6.5, 0.48, { color: MUTED, size: 12, font: F_BODY });
  });

  // Right mock talent card
  card(s, 7.5, 1.2, 5.3, 5.3, { fill: BG_CARD, border: GREEN, bw: 1.5 });

  // Avatar
  s.addShape(pres.shapes.OVAL, { x: 9.45, y: 1.55, w: 0.9, h: 0.9, fill: { color: GREEN_DK }, line: { color: GREEN, width: 1 } });
  txt(s, "SM", 9.45, 1.55, 0.9, 0.9, { color: WHITE, size: 13, bold: true, font: F_BODY, align: "center" });

  txt(s, "Sarah M.",                7.5, 2.6,  5.3, 0.38, { color: WHITE, size: 16, bold: true, font: F_BODY, align: "center" });
  txt(s, "Senior Marketing Manager",7.5, 2.95, 5.3, 0.3,  { color: MUTED, size: 11, font: F_BODY, align: "center" });
  txt(s, "Auckland, NZ",            7.5, 3.22, 5.3, 0.28, { color: MUTED, size: 10, font: F_BODY, align: "center" });

  s.addShape(pres.shapes.RECTANGLE, { x: 7.85, y: 3.55, w: 4.7, h: 0.025, fill: { color: GREEN_DK }, line: { color: GREEN_DK, width: 0 } });

  // Tag pills
  const tags = ["Marketing","Strategy","B2B"];
  const tagX = [7.8, 9.2, 10.5];
  tags.forEach((tag, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tagX[i], y: 3.68, w: 1.1, h: 0.32, fill: { color: BG_DARK }, line: { color: GREEN, width: 0.75 }, rectRadius: 0.08 });
    txt(s, tag, tagX[i], 3.68, 1.1, 0.32, { color: WHITE, size: 9, font: F_BODY, align: "center" });
  });

  txt(s, "CV attached",    7.8, 4.15, 4.8, 0.3, { color: GREEN, size: 11, font: F_BODY });
  txt(s, "Cover letter",   7.8, 4.45, 4.8, 0.3, { color: GREEN, size: 11, font: F_BODY });

  // Buttons
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.9, y: 5.05, w: 2.0, h: 0.38, fill: { color: GREEN_DK }, line: { color: GREEN, width: 1 }, rectRadius: 0.05 });
  txt(s, "View Profile", 7.9, 5.05, 2.0, 0.38, { color: WHITE, size: 10, bold: true, font: F_BODY, align: "center" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.1, y: 5.05, w: 2.1, h: 0.38, fill: { color: GREEN }, line: { color: GREEN, width: 0 }, rectRadius: 0.05 });
  txt(s, "Attach to Job", 10.1, 5.05, 2.1, 0.38, { color: BG_DARK, size: 10, bold: true, font: F_BODY, align: "center" });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 11 — RoxanneAI
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "RoxanneAI — Built-in AI Assistant",                               0.5, 0.3,  12, 0.7,  { color: WHITE, size: 34, bold: true, font: F_TITLE });
  txt(s, "An AI-powered command layer integrated directly into the dashboard",0.5, 1.0,  12, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const feats = [
    { n:"1", head:"Social Media Publishing",  body:"Post to LinkedIn & Facebook via MCP OAuth — with draft review before posting" },
    { n:"2", head:"File Attachment & Analysis",body:"Attach a CV or document — RoxanneAI reads and analyses it in context" },
    { n:"3", head:"Tool Shortcuts",            body:"Convert PDF, Analyse Applicant, Compare Candidates — one-click prompt templates" },
    { n:"4", head:"Dark / Light Theme",        body:"Recruiter-preferred interface with persistent theme toggle" },
    { n:"5", head:"Thinking Animation",        body:"Three-dot loader + cycling status phrases for a polished AI-feel UX" }
  ];

  feats.forEach((f, i) => {
    const fy = 1.55 + i * 0.8;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: fy + 0.04, w: 0.28, h: 0.28, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });
    txt(s, f.n, 0.5, fy + 0.04, 0.28, 0.28, { color: BG_DARK, size: 9, bold: true, font: F_BODY, align: "center" });
    txt(s, f.head, 0.9, fy,      5.4, 0.35, { color: WHITE, size: 14, bold: true, font: F_BODY });
    txt(s, f.body, 0.9, fy + 0.33, 5.4, 0.4,  { color: MUTED, size: 12, font: F_BODY });
  });

  // Chat panel
  card(s, 7.0, 1.0, 5.9, 5.5, { fill: BG_CARD, border: GREEN, bw: 1.5, rounded: false });

  // Header
  s.addShape(pres.shapes.RECTANGLE, { x: 7.1, y: 1.1, w: 5.7, h: 0.55, fill: { color: BG_DARK }, line: { color: BG_DARK, width: 0 } });
  s.addShape(pres.shapes.OVAL, { x: 7.25, y: 1.22, w: 0.3, h: 0.3, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });
  txt(s, "RoxanneAI", 7.65, 1.17, 4.5, 0.45, { color: WHITE, size: 12, bold: true, font: F_BODY, valign: "middle" });

  // Messages
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 1.85, w: 4.2, h: 0.7, fill: { color: GREEN_DK }, line: { color: GREEN_DK, width: 0 }, rectRadius: 0.07 });
  txt(s, "RoxanneAI is ready. Ask me to post, analyse, or compare...", 7.4, 1.85, 4.0, 0.7, { color: WHITE, size: 10, font: F_BODY, valign: "middle" });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.5, y: 2.7, w: 4.0, h: 0.55, fill: { color: BG_DARK }, line: { color: GREEN, width: 0.75 }, rectRadius: 0.07 });
  txt(s, "Analyse the attached CV against the role", 8.55, 2.7, 3.85, 0.55, { color: WHITE, size: 10, font: F_BODY, valign: "middle", align: "right" });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 3.4, w: 2.5, h: 0.55, fill: { color: BG_CARD }, line: { color: GREEN_DK, width: 0.75 }, rectRadius: 0.07 });
  txt(s, "● ● ●  Analysing...", 7.35, 3.4, 2.4, 0.55, { color: GREEN, size: 10, italic: true, font: F_BODY, valign: "middle" });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 4.1, w: 4.8, h: 0.85, fill: { color: GREEN_DK }, line: { color: GREEN_DK, width: 0 }, rectRadius: 0.07 });
  txt(s, "Candidate scores 7/8. Strong experience match. Cover letter present. Recommend shortlisting.", 7.4, 4.1, 4.6, 0.85, { color: WHITE, size: 10, font: F_BODY, valign: "middle" });

  // Icon row
  [0, 0.45, 0.9].forEach(offset => {
    s.addShape(pres.shapes.OVAL, { x: 7.4 + offset, y: 5.55, w: 0.28, h: 0.28, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Backend Architecture
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Backend Architecture",                                         0.5, 0.3,  12, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "Node.js · Express.js · 80+ REST endpoints · Session authentication", 0.5, 1.0,  12, 0.35, { color: GREEN, size: 13, font: F_BODY });

  // Route groups table
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.5, w: 6.5, h: 0.45, fill: { color: GREEN_DK }, line: { color: GREEN_DK, width: 0 } });
  txt(s, "Route Group",  0.55, 1.5, 3.5, 0.45, { color: WHITE, size: 12, bold: true, font: F_BODY });
  txt(s, "Purpose",      4.1,  1.5, 2.8, 0.45, { color: WHITE, size: 12, bold: true, font: F_BODY });

  const routes = [
    ["/api/admin/careers/job-postings",    "Position CRUD + status + AI filter"],
    ["/api/admin/careers/applications",    "Application management + screening"],
    ["/api/admin/careers/talent-pool",     "Talent pool profiles"],
    ["/api/admin/careers/offers",          "Offer tracking & status"],
    ["/api/admin/screenings",              "Scoring, tie-breaking, shortlisting"],
    ["/api/admin/mcp",                     "MCP proxy, OAuth, RoxanneAI"],
    ["/api/admin/dashboard",              "Settings, refresh config, metrics"],
    ["/api/admin/messages",               "Inbox & notification management"]
  ];

  routes.forEach((r, i) => {
    const ry = 1.95 + i * 0.44;
    const rowFill = i % 2 === 0 ? BG_CARD : BG_DARK;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: ry, w: 6.5, h: 0.42, fill: { color: rowFill }, line: { color: rowFill, width: 0 } });
    txt(s, r[0], 0.55, ry, 3.45, 0.42, { color: GREEN, size: 10, font: F_BODY, valign: "middle" });
    txt(s, r[1], 4.1,  ry, 2.8,  0.42, { color: MUTED, size: 10, font: F_BODY, valign: "middle" });
  });

  // Middleware stack
  txt(s, "REQUEST PIPELINE", 7.4, 1.5, 5.4, 0.3, { color: GREEN, size: 10, bold: true, font: F_BODY, align: "center" });

  const pipeline = [
    { label: "Incoming HTTP Request",          highlight: false },
    { label: "requireDashboardAuth",           highlight: true  },
    { label: "Route Handler + Validation",     highlight: false },
    { label: "DB Query (better-sqlite3)",      highlight: false },
    { label: "JSON Response + Error handling", highlight: false }
  ];

  pipeline.forEach((p, i) => {
    const py = 1.85 + i * 0.85;
    const bw = p.highlight ? 2 : 1;
    card(s, 7.4, py, 5.4, 0.7, { fill: BG_CARD, border: GREEN, bw, rounded: false });
    txt(s, p.label, 7.4, py, 5.4, 0.7, { color: p.highlight ? GREEN : WHITE, size: 12, bold: p.highlight, font: F_BODY, align: "center" });
    if (i < pipeline.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, { x: 9.75, y: py + 0.72, w: 0.07, h: 0.11, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 13 — Data Architecture
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Data Architecture",                                       0.5, 0.3,  12, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "SQLite with better-sqlite3 — zero-config, file-based, fast", 0.5, 1.0,  12, 0.35, { color: GREEN, size: 13, font: F_BODY });

  const tables = [
    { name: "career_job_postings",         cols: "id, title, status, filtration_json\nkpi_criteria_json, created_at" },
    { name: "career_applications",         cols: "id, position_id, applicant name/email\nstatus, screening_json" },
    { name: "career_files",                cols: "id, application_id, file_type\nrelative_path, original_name" },
    { name: "career_talent_pool",          cols: "id, full_name, email, skills\ncv_file_id, created_at" },
    { name: "career_employer_submissions", cols: "id, company, role, headcount\nstatus, created_at" },
    { name: "notifications",               cols: "id, type, ref_id, message\nread_at, created_at" },
    { name: "sessions",                    cols: "Session store for dashboard\nauthentication (connect-sqlite3)" },
    { name: "career_shortlisted",          cols: "id, application_id, checklist_json\nmoved_to_interview_at" }
  ];

  tables.forEach((t, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const tx = col === 0 ? 0.4 : 4.45;
    const ty = 1.5 + row * 1.27;
    card(s, tx, ty, 3.8, 1.05, { fill: BG_CARD, border: GREEN, bw: 1 });
    txt(s, t.name, tx + 0.15, ty + 0.05, 3.5, 0.38, { color: GREEN, size: 10, bold: true, font: F_TITLE });
    txt(s, t.cols, tx + 0.15, ty + 0.42, 3.5, 0.55, { color: MUTED, size: 9,  font: F_BODY });
  });

  // Engineering callout
  card(s, 8.6, 1.5, 4.5, 5.2, { fill: BG_CARD, border: GREEN, bw: 1.5 });
  txt(s, "Engineering Patterns", 8.6, 1.65, 4.5, 0.38, { color: GREEN, size: 14, bold: true, font: F_TITLE, align: "center" });

  const patterns = [
    { title: "Safe Migrations",    body: "ensureTableColumn() adds columns without breaking existing data" },
    { title: "JSON Columns",       body: "filtration_json & kpi_criteria_json store flexible AI output" },
    { title: "File Cascade",       body: "Deleting a record cleans up all linked career_files entries" },
    { title: "Notification Hooks", body: "DB mutations auto-trigger notification creation & cleanup" }
  ];

  patterns.forEach((p, i) => {
    const py = 2.25 + i * 1.05;
    dot(s, 8.75, py + 0.06, GREEN, 0.16);
    txt(s, p.title, 9.0, py,       3.9, 0.35, { color: WHITE, size: 12, bold: true, font: F_BODY });
    txt(s, p.body,  9.0, py + 0.33, 3.9, 0.55, { color: MUTED, size: 10, font: F_BODY });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 14 — Technology Stack
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Technology Stack", 0.5, 0.3, 12, 0.7, { color: WHITE, size: 36, bold: true, font: F_TITLE });

  const quads = [
    {
      label: "Frontend",
      x: 0.4,  y: 1.2,
      items: ["React (CDN, Babel)","Vanilla CSS (custom design system)","Responsive layouts","Component architecture (AIPanel, Positions, TalentPool...)"]
    },
    {
      label: "Backend",
      x: 6.65, y: 1.2,
      items: ["Node.js","Express.js","better-sqlite3","Multer (file uploads)","Archiver v8 (ZIP streaming)","express-session + connect-sqlite3"]
    },
    {
      label: "AI & Integrations",
      x: 0.4,  y: 4.15,
      items: ["OpenAI Responses API","MCP Server (social media)","LinkedIn OAuth 2.0","Facebook OAuth","RoxanneAI custom agent layer"]
    },
    {
      label: "Infrastructure & DevOps",
      x: 6.65, y: 4.15,
      items: ["Single-server Node.js deployment","SQLite file-based DB (zero ops)","Static asset serving via Express","Environment-configured via .env","Session persistence"]
    }
  ];

  quads.forEach(q => {
    card(s, q.x, q.y, 5.9, 2.7, { fill: BG_CARD, border: GREEN, bw: 1.5 });
    txt(s, q.label, q.x + 0.2, q.y + 0.12, 5.5, 0.4, { color: GREEN, size: 13, bold: true, font: F_TITLE });
    q.items.forEach((item, ii) => {
      dot(s, q.x + 0.25, q.y + 0.65 + ii * 0.38, GREEN, 0.12);
      txt(s, item, q.x + 0.48, q.y + 0.57 + ii * 0.38, 5.2, 0.35, { color: WHITE, size: 11, font: F_BODY, valign: "middle" });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 15 — Engineering Highlights
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  txt(s, "Engineering Highlights",                              0.5, 0.3,  12, 0.7,  { color: WHITE, size: 36, bold: true, font: F_TITLE });
  txt(s, "Four standout technical achievements from this build",0.5, 1.0,  12, 0.35, { color: MUTED, size: 13, font: F_BODY });

  const highlights = [
    { num:"01", x:0.4,  y:1.5,  title:"AI Document Pipeline",      body:"Per-applicant OpenAI calls evaluate 8 document criteria — results scored, ranked and persisted to DB automatically" },
    { num:"02", x:6.65, y:1.5,  title:"Real-Time Refresh Engine",   body:"Polling system fetches new applications, submissions & talent entries since last load — zero page refresh needed" },
    { num:"03", x:0.4,  y:4.3,  title:"Streaming ZIP Export",       body:"All applicant files for a position streamed as a ZIP archive on demand — no temp file, direct pipe to response" },
    { num:"04", x:6.65, y:4.3,  title:"MCP Social Integration",     body:"RoxanneAI posts to LinkedIn & Facebook via a live MCP server — OAuth, draft review, auto-retry on reconnect" }
  ];

  highlights.forEach(h => {
    card(s, h.x, h.y, 5.9, 2.55, { fill: BG_CARD, border: GREEN, bw: 2 });
    txt(s, h.num,   h.x + 0.25, h.y + 0.2,  1.2,  0.65, { color: GREEN, size: 36, bold: true, font: F_TITLE });
    txt(s, h.title, h.x + 0.25, h.y + 0.85, 5.4,  0.42, { color: WHITE, size: 17, bold: true, font: F_TITLE });
    txt(s, h.body,  h.x + 0.25, h.y + 1.35, 5.4,  1.05, { color: MUTED, size: 12, font: F_BODY });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 16 — Why Glondia (Closing)
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: BG_DARK };

  // Decorative ellipses
  s.addShape(pres.shapes.OVAL, { x: 10.5, y: -1, w: 4, h: 4, fill: { color: GREEN_DK, transparency: 30 }, line: { color: GREEN_DK, width: 0 } });
  s.addShape(pres.shapes.OVAL, { x: 12.2, y: 5.5, w: 1.5, h: 1.5, fill: { color: GREEN, transparency: 40 }, line: { color: GREEN, width: 0 } });

  txt(s, "Built by",               0, 1.0,  13.33, 0.35, { color: MUTED, size: 12, font: F_BODY, align: "center" });
  txt(s, "GLONDIA",                0, 1.4,  13.33, 1.1,  { color: GREEN, size: 48, bold: true, font: F_TITLE, align: "center" });
  txt(s, "ANALYSTS & CONSULTANCY", 0, 2.55, 13.33, 0.4,  { color: MUTED, size: 13, font: F_BODY, align: "center" });

  s.addShape(pres.shapes.RECTANGLE, { x: 4.5, y: 3.1, w: 4.33, h: 0.03, fill: { color: GREEN }, line: { color: GREEN, width: 0 } });

  const valueProps = [
    { x: 0.5,  title: "Full-Stack", body: "From public site to AI dashboard — we own the whole stack" },
    { x: 3.55, title: "AI-Native",  body: "OpenAI, MCP, custom agents — built-in, not bolted on" },
    { x: 6.6,  title: "Bespoke",    body: "No templates, no off-the-shelf — every line written for your business" },
    { x: 9.65, title: "Ongoing",    body: "We build and maintain — long-term partners, not one-off vendors" }
  ];

  valueProps.forEach(vp => {
    card(s, vp.x, 3.4, 2.8, 1.5, { fill: BG_CARD, border: GREEN, bw: 1 });
    txt(s, vp.title, vp.x + 0.15, 3.5,  2.5, 0.38, { color: WHITE, size: 14, bold: true, font: F_BODY });
    txt(s, vp.body,  vp.x + 0.15, 3.88, 2.5, 0.9,  { color: MUTED, size: 10, font: F_BODY });
  });

  txt(s, "Your Personal Business Partner", 0, 5.3, 13.33, 0.5,  { color: GREEN, size: 18, italic: true, font: F_BODY, align: "center" });
  txt(s, "glondiaanalytics.com  ·  hello@glondia.com", 0, 6.0, 13.33, 0.35, { color: MUTED, size: 11, font: F_BODY, align: "center" });
  txt(s, "© 2025 Glondia Analysts & Consultancy",      0, 6.8, 13.33, 0.3,  { color: MUTED, size: 9,  font: F_BODY, align: "center" });
}

// ── Write file ─────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "C:\\Users\\dpm\\Desktop\\glondia-heya-presentation.pptx" })
  .then(() => console.log("Done: glondia-heya-presentation.pptx"))
  .catch(err => { console.error(err); process.exit(1); });
