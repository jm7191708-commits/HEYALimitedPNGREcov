// Mock positions + applicants data (frontend only)
window.CHECKLIST_ITEMS = [
  { id: "clientConfirmed",      label: "Client confirmed" },
  { id: "titleConfirmed",       label: "Job title confirmed" },
  { id: "salaryConfirmed",      label: "Salary / budget confirmed" },
  { id: "locationConfirmed",    label: "Location confirmed" },
  { id: "descriptionDone",      label: "Job description completed" },
  { id: "requirementsDone",     label: "Requirements completed" },
  { id: "closingDateConfirmed", label: "Closing date confirmed" },
  { id: "approvalReceived",     label: "Approval received" },
];

window.BLANK_CHECKLIST = window.CHECKLIST_ITEMS.reduce((a, c) => (a[c.id] = false, a), {});
window.FULL_CHECKLIST  = window.CHECKLIST_ITEMS.reduce((a, c) => (a[c.id] = true, a), {});

// Suggested screening criteria the user can adopt as a starting point
window.DEFAULT_CRITERIA = [
  { id: "exp",      name: "Relevant work experience", description: "Years and depth of related work", maxPoints: 10, weight: 3, required: true,  notes: "" },
  { id: "qual",     name: "Required qualification",   description: "Degree, certifications, etc.",    maxPoints: 10, weight: 2, required: true,  notes: "" },
  { id: "industry", name: "Industry experience",      description: "Domain knowledge",                maxPoints: 10, weight: 2, required: false, notes: "" },
  { id: "resume",   name: "Resume completeness",      description: "Quality and clarity of resume",   maxPoints: 5,  weight: 1, required: false, notes: "" },
  { id: "comms",    name: "Communication skills",     description: "Written communication in materials", maxPoints: 10, weight: 2, required: false, notes: "" },
  { id: "location", name: "Location suitability",     description: "Aligns with role location",       maxPoints: 5,  weight: 1, required: false, notes: "" },
  { id: "avail",    name: "Availability",             description: "Start date / notice period",      maxPoints: 5,  weight: 1, required: false, notes: "" },
];

window.MOCK_POSITIONS = [
  {
    id: "pos-1",
    title: "Senior Frontend Engineer",
    client: "Acme Corp",
    department: "Engineering",
    location: "Remote · US",
    employmentType: "Full-time",
    numHires: 2,
    salaryRange: "$140k – $180k",
    startDate: "2026-07-01",
    closingDate: "2026-06-15",
    description: "Build the next generation of Acme's customer-facing web product. You'll work alongside designers and backend engineers to ship polished, accessible, performant interfaces.",
    responsibilities: "• Lead frontend architecture decisions\n• Mentor 2–3 mid-level engineers\n• Partner with design on the new design system\n• Ship features end-to-end",
    requirements: "• 6+ years of frontend experience\n• Deep React + TypeScript expertise\n• A bias toward shipping\n• Experience with design systems",
    contactPerson: "Sarah Johnson (Head of Eng)",
    reasonForHiring: "Team expansion — new product line",
    status: "published",
    coverLetterRequired: true,
    applied: true,
    checklist: { ...window.FULL_CHECKLIST },
    createdAt: "2026-05-01",
  },
  {
    id: "pos-2",
    title: "Customer Success Manager",
    client: "Bluebird Health",
    department: "Customer",
    location: "Austin, TX",
    employmentType: "Full-time",
    numHires: 1,
    salaryRange: "$95k – $115k",
    startDate: "2026-07-15",
    closingDate: "2026-06-22",
    description: "Own the relationship with enterprise health customers from kickoff through renewal.",
    responsibilities: "• Manage a book of 12–15 strategic accounts\n• Drive product adoption and outcomes\n• Partner with sales on renewals/expansion",
    requirements: "• 4+ years in CS, ideally healthtech or SaaS\n• Strong written + verbal communication\n• Comfort with data tools",
    contactPerson: "Marcus Lee (VP Customer)",
    reasonForHiring: "Backfill — previous CSM promoted",
    status: "ready",
    coverLetterRequired: false,
    applied: true,
    checklist: { ...window.FULL_CHECKLIST },
    createdAt: "2026-05-06",
  },
  {
    id: "pos-3",
    title: "Lead Product Designer",
    client: "Northwind Studios",
    department: "Design",
    location: "NYC (hybrid)",
    employmentType: "Full-time",
    numHires: 1,
    salaryRange: "$165k – $200k",
    startDate: "",
    closingDate: "",
    description: "Shape the visual + interaction language of Northwind's flagship suite.",
    responsibilities: "",
    requirements: "",
    contactPerson: "",
    reasonForHiring: "New role",
    status: "draft",
    coverLetterRequired: false,
    applied: true,
    checklist: { ...window.BLANK_CHECKLIST, clientConfirmed: true, titleConfirmed: true, salaryConfirmed: true },
    createdAt: "2026-05-12",
  },
  {
    id: "pos-4",
    title: "Director of Brand Marketing",
    client: "Acme Corp",
    department: "Marketing",
    location: "NYC",
    employmentType: "Full-time",
    numHires: 1,
    salaryRange: "$190k – $230k",
    startDate: "2026-04-01",
    closingDate: "2026-03-30",
    description: "Own brand strategy across all channels.",
    responsibilities: "• Set brand strategy\n• Lead a team of 4",
    requirements: "• 10+ years brand experience",
    contactPerson: "Jenna Tan",
    reasonForHiring: "Replacement",
    status: "closed",
    coverLetterRequired: true,
    applied: true,
    checklist: { ...window.FULL_CHECKLIST },
    createdAt: "2026-02-10",
  },
  {
    id: "pos-5",
    title: "Accounts Officer",
    client: "Pioneer Finance Ltd",
    department: "Finance",
    location: "Lagos, Nigeria",
    employmentType: "Full-time",
    numHires: 2,
    salaryRange: "₦5M – ₦8M",
    startDate: "2026-07-01",
    closingDate: "2026-06-10",
    description: "Manage day-to-day accounting operations for the Lagos branch.",
    responsibilities: "• Maintain general ledger\n• Prepare monthly statements\n• Liaise with auditors",
    requirements: "• ICAN certification or in progress\n• 3+ years accounting experience\n• Strong Excel skills",
    contactPerson: "Funmi Adeyemi",
    reasonForHiring: "Team expansion",
    status: "screening",
    coverLetterRequired: false,
    applied: true,
    checklist: { ...window.FULL_CHECKLIST },
    filtration: { status: "done", runAt: "2026-05-12", order: ["a-20", "a-21", "a-22", "a-23"] },
    screening: {
      pushedAt: "2026-05-13",
      rankings: ["a-20", "a-21", "a-22", "a-23"],
      criteria: [
        { id: "acc-exp",      name: "Relevant accounting experience",      description: "Years working in accounting/finance roles",       maxPoints: 10, weight: 3, required: true,  notes: "Look for GL, monthly close, reconciliations." },
        { id: "acc-qual",     name: "Required qualification (ICAN/ACCA)",  description: "Holds or is pursuing ICAN or ACCA",               maxPoints: 10, weight: 2, required: true,  notes: "" },
        { id: "acc-software", name: "Accounting software proficiency",     description: "QuickBooks, SAP, or similar",                     maxPoints: 10, weight: 2, required: false, notes: "" },
        { id: "acc-comms",    name: "Communication skills",                description: "Written communication in materials",              maxPoints: 5,  weight: 1, required: false, notes: "" },
        { id: "acc-loc",      name: "Location suitability",                description: "Lagos-based or willing to relocate",              maxPoints: 5,  weight: 1, required: true,  notes: "" },
      ],
    },
    createdAt: "2026-04-20",
  },
  {
    id: "pos-6",
    title: "Site Supervisor",
    client: "BlueStone Construction",
    department: "Operations",
    location: "Abuja, Nigeria",
    employmentType: "Full-time",
    numHires: 1,
    salaryRange: "₦4M – ₦6M",
    startDate: "2026-06-15",
    closingDate: "2026-06-01",
    description: "Supervise construction site activities and safety compliance.",
    responsibilities: "• Site safety walkthroughs\n• Coordinate sub-contractors\n• Daily progress reports",
    requirements: "• HSE Level 3\n• 5+ years on commercial sites\n• Driving license",
    contactPerson: "Kolade Williams",
    reasonForHiring: "New project",
    status: "screening",
    coverLetterRequired: false,
    applied: true,
    checklist: { ...window.FULL_CHECKLIST },
    filtration: { status: "done", runAt: "2026-05-13", order: ["a-24", "a-25", "a-26"] },
    screening: {
      pushedAt: "2026-05-14",
      rankings: ["a-24", "a-25", "a-26"],
      criteria: [],
    },
    createdAt: "2026-05-01",
  },
];

window.MOCK_APPLICANTS = [
  { id: "a-1",  name: "Amelia Okafor",   email: "amelia.okafor@mail.com", phone: "+1 415 555 0101", positionId: "pos-1", status: "shortlisted", appliedAt: "2026-05-10", cvName: "amelia_okafor_resume_v3.pdf", coverLetterName: "amelia_cover.pdf", cvComplete: true },
  { id: "a-2",  name: "Marcus Chen",     email: "marcus.chen@mail.com",   positionId: "pos-1", status: "interview",   appliedAt: "2026-05-08", cvName: "mchen_resume.pdf",           coverLetterName: "mchen_cover.pdf", cvComplete: true },
  { id: "a-3",  name: "Priya Patel",     email: "priya.patel@mail.com",   positionId: "pos-1", status: "new",         appliedAt: "2026-05-13", cvName: "priya_patel.pdf",            coverLetterName: "",                cvComplete: true },
  { id: "a-4",  name: "Jordan Romero",   email: "jordan.romero@mail.com", phone: "+1 415 555 0104", positionId: "pos-1", status: "new",         appliedAt: "2026-05-12", cvName: "jromero.pdf",                coverLetterName: "jromero_cover.pdf", cvComplete: false },
  { id: "a-5",  name: "Chiamaka Berg",   email: "c.berg@mail.com",        positionId: "pos-1", status: "new",         appliedAt: "2026-05-11", cvName: "cberg_cv.pdf",               coverLetterName: "",                cvComplete: true },
  { id: "a-6",  name: "Felix Adeyemi",   email: "felix.adeyemi@mail.com", phone: "+1 415 555 0106", positionId: "pos-1", status: "offer",       appliedAt: "2026-05-05", cvName: "felix_adeyemi.pdf",          coverLetterName: "felix_cl.pdf",    cvComplete: true },
  { id: "a-7",  name: "Yuki Tanaka",     email: "yuki.tanaka@mail.com",   positionId: "pos-1", status: "new",         appliedAt: "2026-05-13", cvName: "",                           coverLetterName: "",                cvComplete: false },
  { id: "a-8",  name: "Sasha Kovač",     email: "",                       positionId: "pos-1", status: "new",         appliedAt: "2026-05-07", cvName: "skovac_resume.pdf",          coverLetterName: "",                cvComplete: false },
  { id: "a-9",  name: "Diego Mendez",    email: "diego.m@mail.com",       positionId: "pos-4", status: "new",         appliedAt: "2026-03-22", cvName: "dmendez_cv.pdf",             coverLetterName: "dmendez_cover.pdf", cvComplete: true },
  { id: "a-10", name: "Naomi Brooks",    email: "naomi.brooks@mail.com",  positionId: "pos-4", status: "new",         appliedAt: "2026-03-25", cvName: "nbrooks.pdf",                coverLetterName: "",                cvComplete: false },
  { id: "a-11", name: "Theo Halawa",     email: "",                       positionId: "pos-4", status: "new",         appliedAt: "2026-03-28", cvName: "",                           coverLetterName: "",                cvComplete: false },
  { id: "a-20", name: "Adebola Adekunle", email: "adebola.adekunle@mail.com", phone: "+234 803 555 0123", positionId: "pos-5", status: "new", appliedAt: "2026-05-11", cvName: "adebola_adekunle_cv.pdf",   coverLetterName: "",               cvComplete: true,
    screening: { status: "screened",   scores: { "acc-exp": { score: 8, mark: "pass", notes: "5 years GL at major bank" }, "acc-qual": { score: 9, mark: "pass", notes: "ICAN Stage 2" }, "acc-software": { score: 7, mark: "pass", notes: "QuickBooks daily user" }, "acc-comms": { score: 4, mark: "pass", notes: "Clear cover letter" }, "acc-loc": { score: 5, mark: "pass", notes: "Lagos resident" } }, ai: null, report: { content: "Strong on experience and qualification.", recommendation: "strong-match" } } },
  { id: "a-21", name: "Funke Bello",      email: "funke.bello@mail.com",      phone: "+234 805 555 0234", positionId: "pos-5", status: "new", appliedAt: "2026-05-10", cvName: "funke_bello.pdf",            coverLetterName: "fbello_cover.pdf", cvComplete: true,
    screening: { status: "in-review",  scores: { "acc-exp": { score: 6, mark: "needs-review", notes: "" }, "acc-qual": { score: 5, mark: "needs-review", notes: "ATSWA only" } }, ai: null, report: { content: "", recommendation: "" } } },
  { id: "a-22", name: "Kunle Okoye",      email: "kunle.okoye@mail.com",      phone: "+234 807 555 0345", positionId: "pos-5", status: "new", appliedAt: "2026-05-09", cvName: "kunle.pdf",                  coverLetterName: "",               cvComplete: false,
    screening: { status: "not-started", scores: {}, ai: null, report: { content: "", recommendation: "" } } },
  { id: "a-23", name: "Ngozi Okafor",     email: "",                          phone: "",                 positionId: "pos-5", status: "new", appliedAt: "2026-05-08", cvName: "",                           coverLetterName: "",               cvComplete: false,
    screening: { status: "needs-more-info", scores: {}, ai: null, report: { content: "Contact details missing.", recommendation: "not-enough-info" } } },
  { id: "a-24", name: "Chidi Nwosu",      email: "chidi.nwosu@mail.com",      phone: "+234 809 555 0456", positionId: "pos-6", status: "new", appliedAt: "2026-05-11", cvName: "chidi_nwosu_cv.pdf",         coverLetterName: "",               cvComplete: true },
  { id: "a-25", name: "Tunde Olatunji",   email: "tunde.olatunji@mail.com",   phone: "+234 811 555 0567", positionId: "pos-6", status: "new", appliedAt: "2026-05-12", cvName: "tunde_olatunji.pdf",         coverLetterName: "tunde_cover.pdf",cvComplete: true },
  { id: "a-26", name: "Aisha Bello",      email: "aisha.bello@mail.com",      phone: "",                 positionId: "pos-6", status: "new", appliedAt: "2026-05-13", cvName: "aisha.pdf",                  coverLetterName: "",               cvComplete: false },
];

window.STATUS_META = {
  draft:     { label: "Draft",     cls: "status-draft" },
  ready:     { label: "Ready",     cls: "status-ready" },
  published: { label: "Published", cls: "status-published" },
  closed:    { label: "Closed",    cls: "status-closed" },
  screening: { label: "Screening", cls: "status-screening" },
};

window.APPLICANT_STATUSES = [
  { id: "applied",     label: "Applied" },
  { id: "screening",   label: "Screening" },
  { id: "screened",    label: "Screened" },
  { id: "shortlist_eligible", label: "Shortlist Eligible" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interview",   label: "Interview" },
  { id: "final_review", label: "Final Review" },
  { id: "offer",       label: "Offer" },
  { id: "hired",       label: "Hired" },
  { id: "not_shortlisted", label: "Not Shortlisted" },
  { id: "rejected",    label: "Rejected" },
  { id: "closed",      label: "Closed" }
];

window.SCREENING_STATUSES = [
  { id: "not-started",            label: "Screening not started", cls: "stage-new" },
  { id: "in-review",              label: "In review",             cls: "stage-interview" },
  { id: "screened",               label: "Screened",              cls: "stage-shortlisted" },
  { id: "recommended-shortlist",  label: "Recommended for shortlist", cls: "stage-hired" },
  { id: "needs-more-info",        label: "Needs more information", cls: "stage-rejected" },
];

// ----- Mock completeness scoring (frontend simulation) -----
window.applicantCompleteness = function(a, pos) {
  const coverRequired = !!(pos && pos.coverLetterRequired);
  const checks = [
    { id: "name",  label: "Name",         ok: !!(a.name  && String(a.name).trim()),  weight: 10, required: true },
    { id: "email", label: "Email",        ok: !!(a.email && String(a.email).trim()), weight: 20, required: true },
    { id: "cv",    label: "CV / Resume",  ok: !!a.cvName,                              weight: 30, required: true },
    { id: "cvFull",label: "Resume complete", ok: !!a.cvName && a.cvComplete !== false, weight: 20, required: false, isResumeQuality: true },
    { id: "cover", label: "Cover letter", ok: !!a.coverLetterName,                     weight: 20, required: coverRequired },
  ];
  let score = 0;
  let max = 0;
  const missingReq = [];
  const missingOpt = [];
  checks.forEach(c => {
    max += c.weight;
    if (c.ok) score += c.weight;
    else (c.required ? missingReq : missingOpt).push(c.label);
  });
  const pct = Math.round((score / max) * 100);
  // Tag the applicant
  let tag;
  if (missingReq.length > 0) tag = "missing-docs";
  else if (a.cvName && a.cvComplete === false) tag = "incomplete-resume";
  else if (missingOpt.length > 0) tag = "needs-review";
  else tag = "complete";
  return { score, max, pct, missingReq, missingOpt, checks, tag };
};

window.COMPLETENESS_TAGS = {
  "complete":          { label: "Complete",          cls: "tag-complete" },
  "needs-review":      { label: "Needs review",      cls: "tag-needs-review" },
  "incomplete-resume": { label: "Incomplete resume", cls: "tag-incomplete-resume" },
  "missing-docs":      { label: "Missing documents", cls: "tag-missing-docs" },
};
