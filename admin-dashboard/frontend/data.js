// HEYA — mock recruiting data
window.HEYA_DATA = (function () {
  const stages = [
    { id: "sourced", name: "Sourced" },
    { id: "applied", name: "Applied" },
    { id: "screen", name: "Phone Screen" },
    { id: "interview", name: "Onsite" },
    { id: "offer", name: "Offer" },
    { id: "hired", name: "Hired" }
  ];

  const jobs = [
    { id: "j1", title: "Staff Product Designer", team: "Design", location: "NYC / Remote", level: "L6", owner: "MK", days: 14, applicants: 142, pipeline: 28, status: "active", priority: "high" },
    { id: "j2", title: "Senior Backend Engineer (Payments)", team: "Engineering", location: "SF", level: "L5", owner: "AP", days: 22, applicants: 218, pipeline: 41, status: "active", priority: "high" },
    { id: "j3", title: "VP, Revenue Operations", team: "Go-to-Market", location: "NYC", level: "Exec", owner: "JT", days: 41, applicants: 64, pipeline: 12, status: "active", priority: "critical" },
    { id: "j4", title: "Lead ML Researcher", team: "Research", location: "Remote", level: "L6", owner: "MK", days: 28, applicants: 89, pipeline: 18, status: "active", priority: "high" },
    { id: "j5", title: "Customer Success Manager", team: "Customer", location: "Austin", level: "L4", owner: "RV", days: 9, applicants: 167, pipeline: 22, status: "active", priority: "medium" },
    { id: "j6", title: "Director of Brand Marketing", team: "Marketing", location: "NYC", level: "L6", owner: "JT", days: 36, applicants: 51, pipeline: 9, status: "paused", priority: "medium" },
    { id: "j7", title: "Senior Recruiter", team: "People", location: "Remote", level: "L5", owner: "JT", days: 6, applicants: 78, pipeline: 14, status: "active", priority: "low" }
  ];

  const tones = ["tone-a", "tone-b", "tone-c", "tone-d", "tone-e", "tone-f"];
  function init(name) {
    return name.split(" ").map(p => p[0]).slice(0, 2).join("");
  }

  const firstNames = ["Amelia", "Marcus", "Priya", "Jordan", "Chiamaka", "Felix", "Yuki", "Sasha", "Diego", "Naomi", "Theo", "Imani", "Olu", "Hana", "Ravi", "Lena", "Kenji", "Adaeze", "Mateo", "Sana", "Beatrix", "Idris", "Min", "Cora", "Niko", "Tomás", "Sora", "Anaya"];
  const lastNames = ["Okafor", "Chen", "Patel", "Romero", "Berg", "Adeyemi", "Tanaka", "Kovač", "Mendez", "Brooks", "Halawa", "Volkov", "Fischer", "Ng", "Bauer", "Singh", "Petit", "Lindgren", "Kassab", "Reyes"];

  function pickName(seed) {
    const f = firstNames[seed % firstNames.length];
    const l = lastNames[(seed * 7) % lastNames.length];
    return f + " " + l;
  }

  const titles = [
    "Senior Product Designer",
    "Staff Software Engineer",
    "ML Research Engineer",
    "Head of Brand",
    "Senior CSM, Enterprise",
    "Engineering Manager",
    "Principal Designer",
    "Backend Engineer, Payments",
    "Recruiting Lead",
    "VP Revenue Operations",
    "Director, Design Systems",
    "Growth PM"
  ];

  const sources = ["Referral", "LinkedIn", "Inbound", "HEYA Outbound", "Hired.com", "Conference", "Talent Pool", "Boomerang"];

  const candidates = [];
  // build 36 candidates distributed across stages
  let id = 1;
  const stageCounts = { sourced: 9, applied: 8, screen: 7, interview: 5, offer: 4, hired: 3 };
  Object.entries(stageCounts).forEach(([stage, n], si) => {
    for (let i = 0; i < n; i++) {
      const seed = id * 13 + si;
      const name = pickName(seed);
      candidates.push({
        id: "c" + id,
        name,
        title: titles[seed % titles.length],
        company: ["Stripe", "Figma", "Linear", "Notion", "Anthropic", "Vercel", "Ramp", "Plaid", "Discord", "Loom"][seed % 10],
        job: jobs[seed % jobs.length].id,
        stage,
        source: sources[seed % sources.length],
        score: 55 + ((seed * 7) % 45),
        avatar: tones[seed % tones.length],
        initials: init(name),
        days: ((seed * 3) % 21) + 1,
        owner: ["MK", "AP", "JT", "RV"][seed % 4],
        salary: 130 + ((seed * 11) % 180),
        notes: ((seed * 5) % 3) + 1
      });
      id++;
    }
  });

  const activity = [
    { who: "Marcus Kell", action: "moved", target: "Priya Patel", to: "Onsite", time: "2m" },
    { who: "AI Assistant", action: "surfaced 4 matches for", target: "Lead ML Researcher", time: "12m" },
    { who: "Aisha Park", action: "left a note on", target: "Jordan Romero", time: "28m" },
    { who: "Jenna Tan", action: "sent offer to", target: "Chiamaka Adeyemi", time: "1h" },
    { who: "Marcus Kell", action: "scheduled debrief for", target: "Felix Berg", time: "1h" },
    { who: "Ravi V.", action: "rejected", target: "Sasha Kovač", time: "3h" },
    { who: "AI Assistant", action: "drafted screening kit for", target: "Staff Product Designer", time: "4h" },
    { who: "Jenna Tan", action: "opened requisition", target: "Senior Recruiter", time: "yesterday" }
  ];

  const tasks = [
    { id: "t1", title: "Debrief: Felix Berg — Staff Product Designer", role: "recruiter", due: "Today, 3:00pm", priority: "high", done: false },
    { id: "t2", title: "Send offer letter to Chiamaka Adeyemi", role: "recruiter", due: "Today", priority: "high", done: false },
    { id: "t3", title: "Source 8 candidates for VP RevOps", role: "recruiter", due: "Tomorrow", priority: "medium", done: false },
    { id: "t4", title: "Review scorecards: 4 pending", role: "manager", due: "Today", priority: "high", done: false },
    { id: "t5", title: "Approve job description: Senior Recruiter", role: "manager", due: "Wed", priority: "medium", done: true },
    { id: "t6", title: "Quarterly funnel review with leadership", role: "leader", due: "Fri", priority: "medium", done: false },
    { id: "t7", title: "Approve compensation band — Eng L5", role: "leader", due: "Thu", priority: "high", done: false },
    { id: "t8", title: "Reply to Amelia Okafor (Notion)", role: "recruiter", due: "Overdue", priority: "high", done: false }
  ];

  const team = [
    { initials: "MK", name: "Marcus Kell", role: "Senior Recruiter", tone: "tone-a", open: 5, hires: 12 },
    { initials: "AP", name: "Aisha Park", role: "Sourcer", tone: "tone-b", open: 8, hires: 9 },
    { initials: "JT", name: "Jenna Tan", role: "Head of Talent", tone: "tone-c", open: 14, hires: 31 },
    { initials: "RV", name: "Ravi Venkat", role: "Coordinator", tone: "tone-d", open: 3, hires: 6 }
  ];

  const calendar = [
    { day: 0, start: 9, end: 10, title: "Phone screen — Amelia Okafor", who: "Marcus Kell", tone: "orange" },
    { day: 0, start: 11, end: 12, title: "Debrief — Felix Berg", who: "Design panel", tone: "gold" },
    { day: 0, start: 14, end: 15.5, title: "Onsite — Priya Patel", who: "Engineering loop", tone: "gold" },
    { day: 1, start: 10, end: 11, title: "Intake — VP RevOps", who: "Jenna + hiring mgr", tone: "" },
    { day: 1, start: 13, end: 14, title: "Phone screen — Theo Mendez", who: "Aisha Park", tone: "orange" },
    { day: 2, start: 9, end: 10, title: "Calibration — Staff PD", who: "Design leadership", tone: "" },
    { day: 2, start: 11, end: 12.5, title: "Onsite — Jordan Romero", who: "Product loop", tone: "gold" },
    { day: 2, start: 15, end: 16, title: "Offer call — Chiamaka", who: "Jenna Tan", tone: "green" },
    { day: 3, start: 10, end: 11, title: "Phone screen — Yuki Tanaka", who: "Marcus Kell", tone: "orange" },
    { day: 3, start: 14, end: 15, title: "Sourcing sprint — ML", who: "Aisha + AI", tone: "" },
    { day: 4, start: 11, end: 12, title: "Weekly funnel review", who: "Talent team", tone: "" },
    { day: 4, start: 14, end: 15, title: "Debrief — Diego Reyes", who: "Eng panel", tone: "gold" }
  ];

  const offers = [
    { name: "Chiamaka Adeyemi", role: "Senior Product Designer", amount: "$215,000 + 0.12%", status: "sent", sent: "Yesterday", expires: "in 4 days" },
    { name: "Theo Mendez", role: "Engineering Manager", amount: "$285,000 + 0.20%", status: "negotiating", sent: "3d ago", expires: "in 2 days" },
    { name: "Hana Lindgren", role: "Director, Brand", amount: "$240,000", status: "accepted", sent: "Last week", expires: "—" }
  ];

  return { stages, jobs, candidates, activity, tasks, team, calendar, offers, tones, init };
})();
