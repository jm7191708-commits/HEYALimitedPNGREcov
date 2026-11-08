"use strict";
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

const IMGS = "C:/Users/dpm/Desktop/HEYALimitedWebsite_Priority_1_Paid_user/public/imgs";

// Brand colours
const NAVY   = "0A1E3D";
const GOLD   = "D4AF55";
const WHITE  = "FFFFFF";
const LIGHT  = "F0F4F9";
const MID    = "1B3A6B";
const MUTED  = "6B7A99";
const DARK   = "071122";

const pres = new pptxgen();
pres.layout  = "LAYOUT_WIDE"; // 13.3" x 7.5"
pres.title   = "HEYA Talent Solutions – Full-Stack Web Platform";
pres.author  = "HEYA Talent Solutions";

const W = 13.3;
const H = 7.5;

// ─── helpers ────────────────────────────────────────────────────────────────

function darkSlide(slide) { slide.background = { color: NAVY }; }
function lightSlide(slide) { slide.background = { color: LIGHT }; }
function whiteSlide(slide) { slide.background = { color: WHITE }; }

function goldBar(slide, y = 0, h = 0.08) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y, w: W, h, fill: { color: GOLD }, line: { color: GOLD } });
}

function sectionLabel(slide, text, x, y, color = GOLD) {
  slide.addText(text.toUpperCase(), {
    x, y, w: 5, h: 0.3, fontSize: 9, bold: true, color,
    charSpacing: 4, margin: 0
  });
}

function slideTitle(slide, text, x = 0.55, y = 0.55, w = 12, color = NAVY, size = 34) {
  slide.addText(text, { x, y, w, h: 0.8, fontSize: size, bold: true, color, margin: 0 });
}

function card(slide, x, y, w, h, fillColor = WHITE) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: "D8E2EF", width: 1 },
    shadow: { type: "outer", color: "000000", blur: 8, offset: 2, angle: 135, opacity: 0.08 }
  });
}

function goldAccentCard(slide, x, y, w, h) {
  card(slide, x, y, w, h);
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.07, h, fill: { color: GOLD }, line: { color: GOLD } });
}

function chip(slide, x, y, text, bg = GOLD, fg = NAVY) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 1.8, h: 0.32,
    fill: { color: bg }, line: { color: bg }, rectRadius: 0.04
  });
  slide.addText(text, { x, y: y + 0.04, w: 1.8, h: 0.28, fontSize: 9, bold: true, color: fg, align: "center", margin: 0 });
}

function dot(slide, x, y, color = GOLD) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: 0.12, h: 0.12, fill: { color }, line: { color } });
}

function arrowRight(slide, x, y) {
  slide.addShape(pres.shapes.LINE, { x, y: y + 0.22, w: 0.3, h: 0, line: { color: GOLD, width: 2 } });
  slide.addText("▶", { x: x + 0.25, y: y + 0.12, w: 0.2, h: 0.2, fontSize: 9, color: GOLD, margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — COVER
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkSlide(s);

  // Try hero image as background-ish on the right
  const heroPath = path.join(IMGS, "heya-workforce-hero-desktop.png");
  if (fs.existsSync(heroPath)) {
    s.addImage({
      path: heroPath,
      x: 5.5, y: 0, w: 7.8, h: H,
      transparency: 60,
      sizing: { type: "cover", w: 7.8, h: H }
    });
  }

  // Dark overlay on left
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 7.5, h: H,
    fill: { color: NAVY, transparency: 0 }, line: { color: NAVY }
  });

  goldBar(s, H - 0.08);

  // Logo mark
  const markPath = path.join(IMGS, "heya-talent-solutions-mark.jpg");
  if (fs.existsSync(markPath)) {
    s.addImage({ path: markPath, x: 0.55, y: 0.5, w: 0.75, h: 0.75 });
  }

  s.addText("HEYA Talent Solutions", { x: 0.55, y: 1.55, w: 6.5, h: 0.45, fontSize: 13, color: GOLD, bold: true, charSpacing: 2, margin: 0 });
  s.addText("Full-Stack Web Platform", { x: 0.55, y: 2.1, w: 6.5, h: 1.3, fontSize: 46, bold: true, color: WHITE, margin: 0 });
  s.addText("Recruitment · Workforce · Talent Acquisition", { x: 0.55, y: 3.55, w: 6.5, h: 0.4, fontSize: 14, color: "A8BDD8", margin: 0 });

  s.addShape(pres.shapes.LINE, { x: 0.55, y: 4.1, w: 2.5, h: 0, line: { color: GOLD, width: 1.5 } });

  s.addText("Three-part engineering overview", { x: 0.55, y: 4.3, w: 6, h: 0.3, fontSize: 11, color: "6B8EB8", margin: 0 });

  const parts = [
    ["01", "Main Website UI/UX"],
    ["02", "Admin Dashboard"],
    ["03", "Backend Architecture"]
  ];
  parts.forEach(([num, label], i) => {
    const y = 4.85 + i * 0.45;
    s.addText(num, { x: 0.55, y, w: 0.4, h: 0.35, fontSize: 10, bold: true, color: GOLD, margin: 0 });
    s.addText(label, { x: 1.05, y, w: 5.5, h: 0.35, fontSize: 11, color: "B0C8E8", margin: 0 });
  });

  s.addText("Papua New Guinea · 2025", { x: 0.55, y: H - 0.5, w: 5, h: 0.28, fontSize: 9, color: "4A6A9A", margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — PROJECT OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Project Overview", 0.55, 0.2);
  slideTitle(s, "What is HEYA Talent Solutions?", 0.55, 0.55, 12);

  const logoPath = path.join(IMGS, "heya-talent-solutions-logo.jpg");
  if (fs.existsSync(logoPath)) {
    s.addImage({ path: logoPath, x: 9.5, y: 0.4, w: 3.2, h: 1.1, sizing: { type: "contain", w: 3.2, h: 1.1 } });
  }

  s.addText("A Papua New Guinean-owned Strategic Talent Acquisition Partner — connecting businesses, government agencies, and contractors with skilled workforce solutions across PNG.", {
    x: 0.55, y: 1.55, w: 8, h: 0.9, fontSize: 14, color: MID, lineSpacingMultiple: 1.3, margin: 0
  });

  // 4 stat boxes
  const stats = [
    ["15+", "Years Industry\nExperience"],
    ["4", "Form Workflows\nwith SendGrid"],
    ["22", "Admin Dashboard\nComponents"],
    ["100%", "Papua New\nGuinean Owned"]
  ];
  stats.forEach(([num, label], i) => {
    const x = 0.55 + i * 3.1;
    card(s, x, 2.7, 2.85, 1.5);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.7, w: 2.85, h: 0.08, fill: { color: GOLD }, line: { color: GOLD } });
    s.addText(num, { x, y: 2.85, w: 2.85, h: 0.75, fontSize: 38, bold: true, color: NAVY, align: "center", margin: 0 });
    s.addText(label, { x, y: 3.6, w: 2.85, h: 0.55, fontSize: 10, color: MUTED, align: "center", lineSpacingMultiple: 1.3, margin: 0 });
  });

  // Feature chips
  s.addText("Core Capabilities", { x: 0.55, y: 4.45, w: 5, h: 0.3, fontSize: 10, bold: true, color: MUTED, margin: 0 });
  const caps = ["Recruitment & Labour Hire", "AI Screening Engine", "Talent Pool Management", "Offer Workflow", "SendGrid Email Pipeline", "Persistent SQLite on Render"];
  caps.forEach((c, i) => {
    const x = 0.55 + (i % 3) * 4.1;
    const y = 4.85 + Math.floor(i / 3) * 0.52;
    goldAccentCard(s, x, y, 3.7, 0.38);
    s.addText(c, { x: x + 0.2, y: y + 0.08, w: 3.4, h: 0.28, fontSize: 10, color: NAVY, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 1 DIVIDER
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  const heroPath = path.join(IMGS, "heya-talent-solutions-hero-logo-space-1600.jpg");
  if (fs.existsSync(heroPath)) {
    s.addImage({ path: heroPath, x: 0, y: 0, w: W, h: H, transparency: 72, sizing: { type: "cover", w: W, h: H } });
  }

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: DARK, transparency: 30 }, line: { color: DARK } });

  goldBar(s, 0);
  goldBar(s, H - 0.08);

  s.addText("PART 01", { x: 0, y: 2.2, w: W, h: 0.5, fontSize: 13, bold: true, color: GOLD, align: "center", charSpacing: 8, margin: 0 });
  s.addText("Main Website", { x: 0, y: 2.85, w: W, h: 1.4, fontSize: 64, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("UI / UX Design", { x: 0, y: 4.3, w: W, h: 0.5, fontSize: 22, color: GOLD, align: "center", margin: 0 });
  s.addText("Public-facing pages · Design system · User journeys", {
    x: 0, y: 5.0, w: W, h: 0.35, fontSize: 12, color: "6B8EB8", align: "center", margin: 0
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — SITE MAP
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 01 — Main Website", 0.55, 0.2);
  slideTitle(s, "Site Architecture & Page Map", 0.55, 0.55, 10);

  // Pages grouped by section
  const groups = [
    { label: "Public Pages", color: NAVY, pages: ["/ Home", "/about", "/services", "/packages", "/contact"] },
    { label: "Careers Portal", color: "1B5E90", pages: ["/careers", "/careers/vacancies", "/careers/jobseekers", "/careers/employers", "/advertise"] },
    { label: "API Endpoints", color: "1D6A4A", pages: ["/api/contact", "/api/advertise", "/api/careers/jobs/:id/apply", "/api/careers/talent-pool"] },
    { label: "Admin", color: "7B3A2A", pages: ["/dashboard (React SPA)", "/api/admin/*", "JWT Auth"] }
  ];

  groups.forEach((g, gi) => {
    const x = 0.4 + gi * 3.15;
    card(s, x, 1.6, 2.85, 5.5, WHITE);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.6, w: 2.85, h: 0.45, fill: { color: g.color }, line: { color: g.color } });
    s.addText(g.label, { x: x + 0.1, y: 1.65, w: 2.65, h: 0.38, fontSize: 11, bold: true, color: WHITE, margin: 0 });
    g.pages.forEach((p, pi) => {
      const py = 2.2 + pi * 0.85;
      dot(s, x + 0.18, py + 0.1, GOLD);
      s.addText(p, { x: x + 0.42, y: py, w: 2.3, h: 0.45, fontSize: 9.5, color: NAVY, margin: 0, lineSpacingMultiple: 1.2 });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — HOMEPAGE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 01 — Homepage", 0.55, 0.2, GOLD);
  s.addText("Homepage — Full-Screen Hero", { x: 0.55, y: 0.55, w: 9, h: 0.8, fontSize: 34, bold: true, color: WHITE, margin: 0 });

  const heroPath = path.join(IMGS, "heya-workforce-hero-desktop.png");
  if (fs.existsSync(heroPath)) {
    s.addImage({ path: heroPath, x: 6.8, y: 0.5, w: 6.1, h: 6.8, transparency: 25, sizing: { type: "cover", w: 6.1, h: 6.8 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 0.5, w: 6.1, h: 6.8, fill: { color: NAVY, transparency: 55 }, line: { color: NAVY } });
  }

  const features = [
    ["Full-Screen Hero", "100svh image fills viewport. Text anchored to bottom-left with dark gradient overlay."],
    ["AI Chatbot", "Floating OpenAI-powered assistant wired to the business context."],
    ["Service Cards", "6 service sections with real-world imagery sourced from PNG industry."],
    ["Careers CTA", "Direct links into the vacancies and talent pool flows."],
    ["Mobile Hero", "Separate mobile layout with reduced imagery for performance."]
  ];

  features.forEach(([title, desc], i) => {
    const y = 1.6 + i * 1.05;
    goldAccentCard(s, 0.55, y, 5.8, 0.88);
    s.addText(title, { x: 0.8, y: y + 0.06, w: 5.3, h: 0.3, fontSize: 11, bold: true, color: NAVY, margin: 0 });
    s.addText(desc, { x: 0.8, y: y + 0.38, w: 5.3, h: 0.42, fontSize: 9.5, color: MUTED, lineSpacingMultiple: 1.2, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — SERVICES & PACKAGES
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  whiteSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 01 — Services & Packages", 0.55, 0.2);
  slideTitle(s, "Services & Advertising Packages", 0.55, 0.55, 10);

  const services = [
    ["Recruitment &\nTalent Acquisition", "End-to-end sourcing, screening, and placement for permanent and contract roles."],
    ["Labour Hire &\nWorkforce Mgmt", "Flexible workforce on short-term and project-based deployments."],
    ["Talent Onboarding\n& Mobilization", "Full mobilization support including logistics, paperwork, and induction."],
    ["HR & Workforce\nSupport Services", "HR advisory, compliance, and workforce planning for PNG operations."],
    ["Advertising &\nTalent Marketing", "Vacancy promotion across social and digital channels in PNG."],
    ["Training &\nJob Ready Programs", "Upskilling and readiness programs for candidates entering new sectors."]
  ];

  services.forEach(([title, desc], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.4 + col * 4.25;
    const y = 1.55 + row * 2.55;
    goldAccentCard(s, x, y, 3.95, 2.2);
    s.addText(title, { x: x + 0.2, y: y + 0.18, w: 3.55, h: 0.65, fontSize: 12, bold: true, color: NAVY, lineSpacingMultiple: 1.2, margin: 0 });
    s.addText(desc, { x: x + 0.2, y: y + 0.88, w: 3.55, h: 1.1, fontSize: 9.5, color: MUTED, lineSpacingMultiple: 1.3, margin: 0 });
  });

  // Package tier row
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 6.75, w: W, h: 0.75, fill: { color: NAVY }, line: { color: NAVY } });
  ["Basic Listing", "Standard Package", "Premium Partner", "Recruitment Support"].forEach((p, i) => {
    s.addText(p, { x: 0.6 + i * 3.15, y: 6.82, w: 2.9, h: 0.4, fontSize: 10, bold: true, color: GOLD, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — CAREERS PORTAL
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 01 — Careers Portal", 0.55, 0.2);
  slideTitle(s, "Careers Portal — Three User Journeys");

  const journeys = [
    {
      role: "Job Seeker",
      color: "0D4F8B",
      steps: ["Browse /careers/vacancies", "View job detail modal", "Click Apply → fill form", "Upload CV + ID Photo", "Write OR upload cover letter (toggle)", "Receive acknowledgement email"]
    },
    {
      role: "Employer",
      color: "1D6A4A",
      steps: ["Visit /advertise or /careers/employers", "Fill vacancy request form", "Submit for review", "HEYA team receives SendGrid notification", "Job posted to vacancies feed", "Applications routed to dashboard"]
    },
    {
      role: "Talent Pool",
      color: "7B3A2A",
      steps: ["Visit /careers/jobseekers", "Submit CV + profile", "Enter desired roles + industries", "Stored in talent pool DB", "AI screening when relevant role opens", "Matched and notified"]
    }
  ];

  journeys.forEach((j, i) => {
    const x = 0.4 + i * 4.25;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.5, w: 4.0, h: 0.48, fill: { color: j.color }, line: { color: j.color } });
    s.addText(j.role, { x: x + 0.15, y: 1.55, w: 3.7, h: 0.38, fontSize: 13, bold: true, color: WHITE, margin: 0 });
    card(s, x, 1.98, 4.0, 5.25, WHITE);
    j.steps.forEach((step, si) => {
      const sy = 2.1 + si * 0.82;
      s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: sy + 0.06, w: 0.26, h: 0.26, fill: { color: j.color }, line: { color: j.color } });
      s.addText(String(si + 1), { x: x + 0.18, y: sy + 0.05, w: 0.26, h: 0.26, fontSize: 8, bold: true, color: WHITE, align: "center", margin: 0 });
      s.addText(step, { x: x + 0.56, y: sy, w: 3.3, h: 0.45, fontSize: 9.5, color: NAVY, lineSpacingMultiple: 1.2, margin: 0 });
    });
  });

  // Cover letter toggle note
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 7.15, w: 12.5, h: 0, line: { color: "D8E2EF", width: 1 } });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — ABOUT & CONTACT
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  whiteSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 01 — About & Contact", 0.55, 0.2);
  slideTitle(s, "About Page & Contact Flows");

  // About page features left
  const aboutImg = path.join(IMGS, "heya-talent-solutions-hero-logo-space-1600.jpg");
  if (fs.existsSync(aboutImg)) {
    s.addImage({ path: aboutImg, x: 0.4, y: 1.45, w: 4.8, h: 3.2, sizing: { type: "cover", w: 4.8, h: 3.2 } });
  }

  const aboutFeatures = [
    "Founder story — Hekeria Yako, 15 yrs mining recruitment",
    "Company overview: HEYA Limited → HEYA Talent Solutions → HY STAP",
    "Core values grid — Integrity, Excellence, Partnership, Reliability, Innovation",
    "Founder track record — Porgera Mine restart, 2,500+ hires",
    "Company Profile download (DOCX served from /files/)"
  ];

  s.addText("About Page", { x: 5.5, y: 1.45, w: 4, h: 0.38, fontSize: 13, bold: true, color: NAVY, margin: 0 });
  aboutFeatures.forEach((f, i) => {
    dot(s, 5.5, 2.0 + i * 0.55 + 0.1, GOLD);
    s.addText(f, { x: 5.75, y: 2.0 + i * 0.55, w: 4.4, h: 0.48, fontSize: 9.5, color: NAVY, lineSpacingMultiple: 1.2, margin: 0 });
  });

  // Contact card right
  card(s, 10.2, 1.45, 2.7, 5.7, LIGHT);
  s.addShape(pres.shapes.RECTANGLE, { x: 10.2, y: 1.45, w: 2.7, h: 0.4, fill: { color: NAVY }, line: { color: NAVY } });
  s.addText("Contact", { x: 10.3, y: 1.5, w: 2.5, h: 0.3, fontSize: 12, bold: true, color: WHITE, margin: 0 });

  const contactItems = [
    ["Email form", "Routes to SendGrid + acknowledgement"],
    ["Phone", "Direct tel: link"],
    ["Location", "Port Moresby, NCD"],
    ["Social links", "Facebook + LinkedIn cards"],
    ["Career intent routing", "Form detects job/CV intent and shows relevant fields"],
    ["File uploads", "CV + cover letter in contact flow"]
  ];
  contactItems.forEach(([label, val], i) => {
    const cy = 2.0 + i * 0.82;
    s.addText(label, { x: 10.3, y: cy, w: 2.5, h: 0.28, fontSize: 9, bold: true, color: NAVY, margin: 0 });
    s.addText(val, { x: 10.3, y: cy + 0.28, w: 2.5, h: 0.42, fontSize: 8.5, color: MUTED, lineSpacingMultiple: 1.2, margin: 0 });
  });

  // UI system strip at bottom
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 6.75, w: W, h: 0.75, fill: { color: LIGHT }, line: { color: "D8E2EF", width: 1 } });
  s.addText("Design System:", { x: 0.55, y: 6.87, w: 1.8, h: 0.38, fontSize: 9, bold: true, color: MUTED, margin: 0 });
  [["Navy", NAVY], ["Gold", GOLD], ["Surface", "EEF4F9"], ["Dark", DARK]].forEach(([name, hex], i) => {
    const cx = 2.5 + i * 1.1;
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 6.92, w: 0.3, h: 0.3, fill: { color: hex }, line: { color: "D8E2EF" } });
    s.addText(name, { x: cx + 0.35, y: 6.92, w: 0.7, h: 0.3, fontSize: 8.5, color: MUTED, margin: 0 });
  });
  s.addText("Fonts: Raleway (headings) · Inter (body) · Font-nav (nav labels)", {
    x: 7.0, y: 6.87, w: 5.8, h: 0.38, fontSize: 9, color: MUTED, margin: 0
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 2 DIVIDER
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: MID };

  goldBar(s, 0);
  goldBar(s, H - 0.08);

  s.addText("PART 02", { x: 0, y: 2.2, w: W, h: 0.5, fontSize: 13, bold: true, color: GOLD, align: "center", charSpacing: 8, margin: 0 });
  s.addText("Admin Dashboard", { x: 0, y: 2.85, w: W, h: 1.3, fontSize: 60, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("React SPA · Internal Operations · AI-Powered", {
    x: 0, y: 4.25, w: W, h: 0.45, fontSize: 16, color: GOLD, align: "center", margin: 0
  });

  const pillItems = ["Job Postings", "Applicants", "AI Screening", "Talent Pool", "Offers", "Pipeline"];
  pillItems.forEach((p, i) => {
    const x = 1.2 + i * 1.85;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 5.1, w: 1.65, h: 0.38, fill: { color: WHITE, transparency: 85 }, line: { color: WHITE, width: 1 } });
    s.addText(p, { x, y: 5.14, w: 1.65, h: 0.3, fontSize: 9.5, color: WHITE, align: "center", bold: true, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — DASHBOARD OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 02 — Admin Dashboard", 0.55, 0.2);
  slideTitle(s, "Dashboard Architecture & Modules");

  const modules = [
    { name: "Overview", icon: "📊", desc: "KPI summary, recent activity, submission counts across all channels." },
    { name: "Job Postings", icon: "📋", desc: "Create, publish, approve, and manage job listings. Vacancy details, closing dates, urgency flags." },
    { name: "Applicants", icon: "👤", desc: "Full applicant profiles. CV, ID Photo, cover letter downloads. Status tracking." },
    { name: "AI Screening", icon: "🤖", desc: "OpenAI-powered ranking engine. Criteria scoring, tie-breaker, ranked shortlist." },
    { name: "Talent Pool", icon: "🗄️", desc: "CV submissions not tied to a role. Stored for future matching." },
    { name: "Pipeline", icon: "🔄", desc: "Kanban-style pipeline view tracking applicant progression stages." },
    { name: "Offers", icon: "✅", desc: "Offer workflow — extend, track, accept/decline. History log per applicant." },
    { name: "Tasks & Calendar", icon: "📅", desc: "Internal task management and scheduling for HR operations." }
  ];

  modules.forEach((m, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.4 + col * 3.15;
    const y = 1.5 + row * 2.6;
    card(s, x, y, 2.95, 2.3, WHITE);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.95, h: 0.06, fill: { color: GOLD }, line: { color: GOLD } });
    s.addText(m.icon + "  " + m.name, { x: x + 0.15, y: y + 0.15, w: 2.65, h: 0.4, fontSize: 12, bold: true, color: NAVY, margin: 0 });
    s.addText(m.desc, { x: x + 0.15, y: y + 0.65, w: 2.65, h: 1.5, fontSize: 9, color: MUTED, lineSpacingMultiple: 1.3, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — AI SCREENING
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 02 — AI Screening Engine", 0.55, 0.2, GOLD);
  s.addText("AI-Powered Screening & Shortlisting", { x: 0.55, y: 0.55, w: 11, h: 0.8, fontSize: 34, bold: true, color: WHITE, margin: 0 });

  // Flow diagram
  const steps = [
    { label: "Job Posting", sub: "Employer submits\nrole + criteria", color: "1B5E90" },
    { label: "Applications", sub: "Applicants submit\nCV + cover letter", color: "1D6A4A" },
    { label: "AI Ranking", sub: "OpenAI scores each\napplicant vs criteria", color: "7B3A2A" },
    { label: "Tie-Breaker", sub: "Custom criteria break\ntied scores", color: "5A2D82" },
    { label: "Shortlist", sub: "Ranked list pushed\nto HR dashboard", color: MID }
  ];

  steps.forEach((step, i) => {
    const x = 0.4 + i * 2.45;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.7, w: 2.15, h: 2.5, fill: { color: step.color }, line: { color: step.color } });
    s.addText(step.label, { x, y: 1.85, w: 2.15, h: 0.45, fontSize: 12, bold: true, color: WHITE, align: "center", margin: 0 });
    s.addText(step.sub, { x, y: 2.45, w: 2.15, h: 0.9, fontSize: 9.5, color: "B0C8E8", align: "center", lineSpacingMultiple: 1.3, margin: 0 });
    s.addText(String(i + 1), { x, y: 3.5, w: 2.15, h: 0.55, fontSize: 28, bold: true, color: "5A7DA0", align: "center", margin: 0 });
    if (i < steps.length - 1) {
      s.addText("→", { x: x + 2.15, y: 2.7, w: 0.3, h: 0.4, fontSize: 18, color: GOLD, align: "center", margin: 0 });
    }
  });

  // Features list
  const aiFeatures = [
    ["Criteria-based scoring", "HR defines weighted criteria. AI evaluates each applicant against them using structured scoring."],
    ["Tie-breaker system", "When scores are tied, custom criteria (interview scores, tests) are applied to differentiate."],
    ["Shortlist report", "Auto-generated report per applicant with scores, reasoning, and recommendation."],
    ["Offer history", "Full JSON offer history log — extended, accepted, declined, withdrawn — all timestamped."]
  ];

  aiFeatures.forEach(([title, desc], i) => {
    const x = 0.4 + (i % 2) * 6.4;
    const y = 4.55 + Math.floor(i / 2) * 1.4;
    goldAccentCard(s, x, y, 6.1, 1.15);
    s.addText(title, { x: x + 0.2, y: y + 0.1, w: 5.7, h: 0.35, fontSize: 11, bold: true, color: NAVY, margin: 0 });
    s.addText(desc, { x: x + 0.2, y: y + 0.5, w: 5.7, h: 0.55, fontSize: 9.5, color: MUTED, lineSpacingMultiple: 1.2, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — PIPELINE & TALENT POOL
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  whiteSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 02 — Pipeline & Talent Pool", 0.55, 0.2);
  slideTitle(s, "Applicant Pipeline & Talent Pool Management");

  // Pipeline stages
  s.addText("Application Pipeline Stages", { x: 0.55, y: 1.45, w: 7, h: 0.35, fontSize: 11, bold: true, color: MUTED, margin: 0 });
  const stages = ["New", "Under Review", "Shortlisted", "Interview", "Offer Extended", "Hired / Declined"];
  const stageColors = [MUTED, "1B5E90", "1D6A4A", "7B3A2A", GOLD, NAVY];
  stages.forEach((stage, i) => {
    const x = 0.4 + i * 2.05;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.9, w: 1.9, h: 0.6, fill: { color: stageColors[i] }, line: { color: stageColors[i] } });
    s.addText(stage, { x, y: 1.95, w: 1.9, h: 0.5, fontSize: 9.5, bold: true, color: WHITE, align: "center", margin: 0 });
    if (i < stages.length - 1) {
      s.addText("›", { x: x + 1.9, y: 1.98, w: 0.15, h: 0.44, fontSize: 18, color: GOLD, align: "center", margin: 0 });
    }
  });

  // Two columns below
  // Talent pool left
  card(s, 0.4, 2.75, 5.9, 4.45, LIGHT);
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 2.75, w: 5.9, h: 0.45, fill: { color: NAVY }, line: { color: NAVY } });
  s.addText("Talent Pool", { x: 0.55, y: 2.8, w: 5.6, h: 0.35, fontSize: 12, bold: true, color: WHITE, margin: 0 });
  const talentItems = [
    "Candidates not tied to a specific role",
    "Stored with desired roles, industries, skills",
    "CV + cover letter filed to career_talent_pool_submissions",
    "AI screening triggered when matching role opens",
    "Linked to applicant profile on match"
  ];
  talentItems.forEach((t, i) => {
    dot(s, 0.55, 3.35 + i * 0.68 + 0.08, GOLD);
    s.addText(t, { x: 0.8, y: 3.35 + i * 0.68, w: 5.3, h: 0.55, fontSize: 10, color: NAVY, lineSpacingMultiple: 1.2, margin: 0 });
  });

  // Offer workflow right
  card(s, 6.7, 2.75, 6.2, 4.45, LIGHT);
  s.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 2.75, w: 6.2, h: 0.45, fill: { color: MID }, line: { color: MID } });
  s.addText("Offer Workflow", { x: 6.85, y: 2.8, w: 5.9, h: 0.35, fontSize: 12, bold: true, color: WHITE, margin: 0 });
  const offerStates = [
    ["Extended", "Offer sent to candidate with terms"],
    ["Accepted", "Candidate confirms — triggers onboarding"],
    ["Declined", "Candidate declines — next shortlisted candidate considered"],
    ["Withdrawn", "Employer withdraws offer"],
    ["Closed", "Position filled or cancelled"]
  ];
  offerStates.forEach(([state, desc], i) => {
    const oy = 3.35 + i * 0.75;
    s.addShape(pres.shapes.RECTANGLE, { x: 6.85, y: oy + 0.04, w: 1.1, h: 0.28, fill: { color: GOLD }, line: { color: GOLD } });
    s.addText(state, { x: 6.85, y: oy + 0.04, w: 1.1, h: 0.28, fontSize: 8.5, bold: true, color: NAVY, align: "center", margin: 0 });
    s.addText(desc, { x: 8.1, y: oy, w: 4.6, h: 0.5, fontSize: 9.5, color: NAVY, lineSpacingMultiple: 1.2, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 3 DIVIDER
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: NAVY, transparency: 60 }, line: { color: NAVY } });

  goldBar(s, 0);
  goldBar(s, H - 0.08);

  s.addText("PART 03", { x: 0, y: 2.2, w: W, h: 0.5, fontSize: 13, bold: true, color: GOLD, align: "center", charSpacing: 8, margin: 0 });
  s.addText("Backend Architecture", { x: 0, y: 2.85, w: W, h: 1.3, fontSize: 52, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("Engineering · Data Model · Integrations", {
    x: 0, y: 4.25, w: W, h: 0.45, fontSize: 16, color: GOLD, align: "center", margin: 0
  });

  const techItems = ["Express.js", "EJS Templates", "SQLite + better-sqlite3", "OpenAI API", "SendGrid", "React (Dashboard)", "Render (Cloud)", "GitHub CI/CD"];
  techItems.forEach((t, i) => {
    const x = 0.6 + (i % 4) * 3.1;
    const y = 5.05 + Math.floor(i / 4) * 0.48;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.8, h: 0.35, fill: { color: WHITE, transparency: 90 }, line: { color: WHITE, width: 1 } });
    s.addText(t, { x, y: y + 0.04, w: 2.8, h: 0.28, fontSize: 9.5, color: WHITE, align: "center", bold: true, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — TECH STACK
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 03 — Tech Stack", 0.55, 0.2);
  slideTitle(s, "Technology Stack");

  const stack = [
    {
      layer: "Frontend", color: "1B5E90",
      items: ["EJS server-side templates", "Vanilla JS (site.js ~1k lines)", "Custom CSS (site.css)", "Raleway + Inter fonts", "Font Awesome icons"]
    },
    {
      layer: "Backend", color: "1D6A4A",
      items: ["Node.js + Express.js", "EJS view engine", "better-sqlite3 (sync SQLite)", "body-parser + CORS", "JWT session auth (dashboard)"]
    },
    {
      layer: "Dashboard", color: "7B3A2A",
      items: ["React 18 SPA (admin-dashboard/)", "Preact/React components", "22 dashboard components", "REST API consumer", "No external UI framework"]
    },
    {
      layer: "Integrations", color: "5A2D82",
      items: ["SendGrid (4 email flows)", "OpenAI GPT-4 (AI screening + chatbot)", "GitHub (source control)", "Render (cloud deploy)", "Persistent SSD disk (SQLite)"]
    }
  ];

  stack.forEach((layer, i) => {
    const x = 0.4 + i * 3.15;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.5, w: 2.95, h: 0.52, fill: { color: layer.color }, line: { color: layer.color } });
    s.addText(layer.layer, { x: x + 0.12, y: 1.56, w: 2.71, h: 0.4, fontSize: 14, bold: true, color: WHITE, margin: 0 });
    card(s, x, 2.02, 2.95, 5.18, WHITE);
    layer.items.forEach((item, ii) => {
      dot(s, x + 0.15, 2.2 + ii * 0.85 + 0.1, layer.color);
      s.addText(item, { x: x + 0.42, y: 2.2 + ii * 0.85, w: 2.4, h: 0.65, fontSize: 9.5, color: NAVY, lineSpacingMultiple: 1.2, margin: 0 });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 12 — SERVER & API ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 03 — Server Architecture", 0.55, 0.2, GOLD);
  s.addText("Server & API Architecture", { x: 0.55, y: 0.55, w: 11, h: 0.8, fontSize: 34, bold: true, color: WHITE, margin: 0 });

  // Architecture diagram using shapes
  // Client box
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.6, w: 2.5, h: 1.2, fill: { color: MID }, line: { color: MID } });
  s.addText("Client Browser", { x: 0.4, y: 1.72, w: 2.5, h: 0.38, fontSize: 11, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("EJS Pages\nReact Dashboard\nVanilla JS", { x: 0.4, y: 2.1, w: 2.5, h: 0.62, fontSize: 8.5, color: "A8BDD8", align: "center", lineSpacingMultiple: 1.2, margin: 0 });

  // Arrow
  s.addShape(pres.shapes.LINE, { x: 2.9, y: 2.18, w: 0.8, h: 0, line: { color: GOLD, width: 2 } });
  s.addText("HTTP", { x: 2.9, y: 1.9, w: 0.8, h: 0.22, fontSize: 8, color: GOLD, align: "center", margin: 0 });

  // Express server box
  s.addShape(pres.shapes.RECTANGLE, { x: 3.7, y: 1.6, w: 2.9, h: 1.2, fill: { color: "1D4A2A" }, line: { color: "1D4A2A" } });
  s.addText("Express Server", { x: 3.7, y: 1.72, w: 2.9, h: 0.38, fontSize: 11, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("server.js\nRoutes · Middleware\nAuth · File Handling", { x: 3.7, y: 2.1, w: 2.9, h: 0.62, fontSize: 8.5, color: "A8D8B8", align: "center", lineSpacingMultiple: 1.2, margin: 0 });

  // Arrow to DB
  s.addShape(pres.shapes.LINE, { x: 6.6, y: 2.18, w: 0.8, h: 0, line: { color: GOLD, width: 2 } });

  // Database
  s.addShape(pres.shapes.RECTANGLE, { x: 7.4, y: 1.6, w: 2.4, h: 1.2, fill: { color: "4A1A1A" }, line: { color: "4A1A1A" } });
  s.addText("SQLite DB", { x: 7.4, y: 1.72, w: 2.4, h: 0.38, fontSize: 11, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("better-sqlite3\n17 tables\nRender Disk", { x: 7.4, y: 2.1, w: 2.4, h: 0.62, fontSize: 8.5, color: "E8B0A8", align: "center", lineSpacingMultiple: 1.2, margin: 0 });

  // Arrow to integrations
  s.addShape(pres.shapes.LINE, { x: 9.8, y: 2.18, w: 0.7, h: 0, line: { color: GOLD, width: 2 } });

  // Integrations
  s.addShape(pres.shapes.RECTANGLE, { x: 10.5, y: 1.6, w: 2.4, h: 1.2, fill: { color: "3A1A5A" }, line: { color: "3A1A5A" } });
  s.addText("Integrations", { x: 10.5, y: 1.72, w: 2.4, h: 0.38, fontSize: 11, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText("SendGrid\nOpenAI GPT-4\nGitHub / Render", { x: 10.5, y: 2.1, w: 2.4, h: 0.62, fontSize: 8.5, color: "C8A8E8", align: "center", lineSpacingMultiple: 1.2, margin: 0 });

  // API endpoints table
  s.addText("Key API Endpoints", { x: 0.55, y: 3.1, w: 8, h: 0.35, fontSize: 11, bold: true, color: GOLD, margin: 0 });

  const endpoints = [
    ["POST", "/api/contact", "Contact form — save + SendGrid notification"],
    ["POST", "/api/advertise", "Employer vacancy request — save + email"],
    ["GET",  "/api/careers/jobs", "Fetch all active job listings (JSON)"],
    ["GET",  "/api/careers/jobs/:id", "Single job detail for apply modal"],
    ["POST", "/api/careers/jobs/:id/apply", "Job application — CV + files + SendGrid"],
    ["POST", "/api/careers/talent-pool", "Talent pool submission + email"],
    ["GET",  "/api/admin/careers/dashboard", "Dashboard data (auth required)"],
    ["POST", "/api/admin/careers/job-postings", "Create new job posting (auth)"],
    ["PATCH","/api/admin/careers/job-postings/:id/screening", "AI screening trigger (auth)"]
  ];

  endpoints.forEach(([method, route, desc], i) => {
    const y = 3.6 + i * 0.42;
    const methodColor = method === "POST" ? "1D6A4A" : method === "PATCH" ? "5A2D82" : "1B5E90";
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: y + 0.04, w: 0.65, h: 0.26, fill: { color: methodColor }, line: { color: methodColor } });
    s.addText(method, { x: 0.4, y: y + 0.04, w: 0.65, h: 0.26, fontSize: 7.5, bold: true, color: WHITE, align: "center", margin: 0 });
    s.addText(route, { x: 1.15, y, w: 3.8, h: 0.38, fontSize: 9, color: GOLD, margin: 0, fontFace: "Consolas" });
    s.addText(desc, { x: 5.1, y, w: 7.8, h: 0.38, fontSize: 9, color: "A8BDD8", margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 13 — DATABASE MODEL
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 03 — Data Model", 0.55, 0.2);
  slideTitle(s, "Database Model — 17 SQLite Tables");

  const tableGroups = [
    {
      group: "Contact & Enquiries", color: "1B5E90",
      tables: ["contact_enquiries", "vacancy_enquiries"]
    },
    {
      group: "Careers Core", color: "1D6A4A",
      tables: ["career_job_postings", "career_applicants", "career_job_applications", "career_employer_submissions"]
    },
    {
      group: "Files & Talent", color: "7B3A2A",
      tables: ["career_files", "career_talent_pool_submissions", "career_messages"]
    },
    {
      group: "Screening & Offers", color: "5A2D82",
      tables: ["career_screenings", "career_screening_applicants", "shortlisted_applicants", "shortlisted_final_checklists", "shortlisting_criteria"]
    },
    {
      group: "System", color: MUTED,
      tables: ["career_notifications", "career_screening_tie_breaker_criteria"]
    }
  ];

  tableGroups.forEach((g, gi) => {
    const x = 0.35 + gi * 2.55;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.5, w: 2.35, h: 0.45, fill: { color: g.color }, line: { color: g.color } });
    s.addText(g.group, { x: x + 0.08, y: 1.55, w: 2.19, h: 0.35, fontSize: 9, bold: true, color: WHITE, lineSpacingMultiple: 1.1, margin: 0 });
    card(s, x, 1.95, 2.35, 5.25, WHITE);
    g.tables.forEach((t, ti) => {
      const ty = 2.1 + ti * 0.75;
      s.addShape(pres.shapes.RECTANGLE, { x: x + 0.1, y: ty, w: 2.15, h: 0.55, fill: { color: LIGHT }, line: { color: "D8E2EF", width: 1 } });
      s.addText(t, { x: x + 0.17, y: ty + 0.07, w: 2.0, h: 0.42, fontSize: 8, color: NAVY, lineSpacingMultiple: 1.1, margin: 0, fontFace: "Consolas" });
    });
  });

  // Key relationships note
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 6.6, w: 12.6, h: 0.7, fill: { color: NAVY }, line: { color: NAVY } });
  s.addText("Key relationships: career_job_applications → career_applicants (one-to-many) · career_files (polymorphic owner_type/owner_id) · career_screening_applicants → career_screenings · shortlisted_applicants → career_job_applications", {
    x: 0.55, y: 6.68, w: 12.2, h: 0.52, fontSize: 8.5, color: "A8BDD8", lineSpacingMultiple: 1.2, margin: 0
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 14 — EMAIL & DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkSlide(s);
  goldBar(s, 0);

  sectionLabel(s, "Part 03 — Email & Deployment", 0.55, 0.2, GOLD);
  s.addText("SendGrid Integration & Render Deployment", { x: 0.55, y: 0.55, w: 12, h: 0.8, fontSize: 30, bold: true, color: WHITE, margin: 0 });

  // Left — SendGrid
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.6, w: 5.9, h: 0.42, fill: { color: "1D6A4A" }, line: { color: "1D6A4A" } });
  s.addText("SendGrid Email System", { x: 0.55, y: 1.65, w: 5.6, h: 0.32, fontSize: 13, bold: true, color: WHITE, margin: 0 });

  const emailFlows = [
    ["Contact Form", "/api/contact", "Notification to HR + acknowledgement to enquirer"],
    ["Advertise a Vacancy", "/api/advertise", "Notification to HR + acknowledgement to employer"],
    ["Job Application", "/api/careers/jobs/:id/apply", "Notification to HR + acknowledgement to applicant"],
    ["Talent Pool", "/api/careers/talent-pool", "Notification to HR + acknowledgement to candidate"]
  ];

  emailFlows.forEach(([form, route, desc], i) => {
    const y = 2.18 + i * 1.12;
    goldAccentCard(s, 0.4, y, 5.9, 0.95);
    s.addText(form, { x: 0.62, y: y + 0.08, w: 5.5, h: 0.3, fontSize: 10, bold: true, color: NAVY, margin: 0 });
    s.addText(route, { x: 0.62, y: y + 0.38, w: 5.5, h: 0.22, fontSize: 8.5, color: MUTED, margin: 0, fontFace: "Consolas" });
    s.addText(desc, { x: 0.62, y: y + 0.6, w: 5.5, h: 0.28, fontSize: 8.5, color: MUTED, margin: 0 });
  });

  s.addText("Controlled by SENDGRID_ENABLED env var — safe to develop with emails off", {
    x: 0.4, y: 6.62, w: 5.9, h: 0.35, fontSize: 8.5, color: "6B8EB8", margin: 0
  });

  // Right — Render deployment
  s.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 1.6, w: 6.1, h: 0.42, fill: { color: MID }, line: { color: MID } });
  s.addText("Render Cloud Deployment", { x: 6.95, y: 1.65, w: 5.8, h: 0.32, fontSize: 13, bold: true, color: WHITE, margin: 0 });

  const deployItems = [
    ["GitHub → Render CI/CD", "Push to main triggers auto-deploy on Render."],
    ["Persistent Disk (SSD)", "SQLite mounted at RENDER_DISK_MOUNT_PATH. Data survives redeploys."],
    ["Environment Variables", "SENDGRID_API_KEY, BUSINESS_EMAIL, EMAIL_TO_INTERNAL, OPENAI_API_KEY, JWT_SECRET all set in Render dashboard."],
    ["Zero-downtime deploys", "Render spins new instance, routes traffic, terminates old."],
    ["Health endpoint", "GET /health returns 200 — used by Render's health checks."]
  ];

  deployItems.forEach(([title, desc], i) => {
    const y = 2.18 + i * 0.98;
    goldAccentCard(s, 6.8, y, 6.1, 0.82);
    s.addText(title, { x: 7.02, y: y + 0.08, w: 5.7, h: 0.28, fontSize: 10, bold: true, color: NAVY, margin: 0 });
    s.addText(desc, { x: 7.02, y: y + 0.38, w: 5.7, h: 0.38, fontSize: 9, color: MUTED, lineSpacingMultiple: 1.2, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 15 — CLOSING
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkSlide(s);

  const heroPath = path.join(IMGS, "heya-workforce-hero-desktop.png");
  if (fs.existsSync(heroPath)) {
    s.addImage({ path: heroPath, x: 0, y: 0, w: W, h: H, transparency: 70, sizing: { type: "cover", w: W, h: H } });
  }
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: NAVY, transparency: 35 }, line: { color: NAVY } });

  goldBar(s, 0);
  goldBar(s, H - 0.08);

  const logoPath = path.join(IMGS, "heya-talent-solutions-mark.jpg");
  if (fs.existsSync(logoPath)) {
    s.addImage({ path: logoPath, x: (W - 1.2) / 2, y: 0.6, w: 1.2, h: 1.2 });
  }

  s.addText("HEYA Talent Solutions", { x: 0, y: 1.95, w: W, h: 0.45, fontSize: 15, bold: true, color: GOLD, align: "center", charSpacing: 3, margin: 0 });
  s.addText("Connecting Talent.\nEmpowering Business.\nBuilding the Future.", {
    x: 0, y: 2.5, w: W, h: 2.0, fontSize: 40, bold: true, color: WHITE, align: "center", lineSpacingMultiple: 1.15, margin: 0
  });

  s.addShape(pres.shapes.LINE, { x: (W - 3) / 2, y: 4.65, w: 3, h: 0, line: { color: GOLD, width: 1.5 } });

  s.addText("Papua New Guinea's Strategic Talent Acquisition Partner", {
    x: 0, y: 4.85, w: W, h: 0.35, fontSize: 12, color: "A8BDD8", align: "center", margin: 0
  });

  // Summary stats row
  const summary = [["9 Pages", "Public website"], ["22 Components", "Admin dashboard"], ["17 Tables", "SQLite schema"], ["4 Email Flows", "SendGrid"], ["2 AI Integrations", "OpenAI GPT-4"]];
  summary.forEach(([stat, label], i) => {
    const x = 0.8 + i * 2.35;
    s.addText(stat, { x, y: 5.5, w: 2.1, h: 0.45, fontSize: 14, bold: true, color: GOLD, align: "center", margin: 0 });
    s.addText(label, { x, y: 5.98, w: 2.1, h: 0.28, fontSize: 8.5, color: "7A9CC8", align: "center", margin: 0 });
  });
}

// ─── Write file ─────────────────────────────────────────────────────────────
const outPath = "C:/Users/dpm/Desktop/HEYA-Talent-Solutions-Presentation.pptx";
pres.writeFile({ fileName: outPath })
  .then(() => console.log("✅ Saved:", outPath))
  .catch(err => { console.error("❌ Error:", err); process.exit(1); });
