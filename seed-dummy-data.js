/**
 * seed-dummy-data.js
 * Inserts dummy applicant data from dummy_applicant_data/ into the live SQLite DB.
 * Run once: node seed-dummy-data.js
 *
 * Creates:
 *   - 2 published job postings
 *   - 20 applications (10 per posting)
 *   - CV + Cover Letter file records per applicant
 *   - Varied statuses across the pipeline for realistic testing
 */

import "./env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { careersDb } from "./careers-db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DUMMY_DIR = path.join(__dirname, "dummy_applicant_data");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ── Helpers ──────────────────────────────────────────────────────────────────

function readUpload(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    contentBase64: buffer.toString("base64"),
    type: DOCX_MIME
  };
}

function docxPaths(folder, firstName, lastName) {
  const base = `${firstName}_${lastName}`;
  return {
    cv:          path.join(folder, `${base}_CV.docx`),
    coverLetter: path.join(folder, `${base}_Cover_Letter.docx`),
  };
}

// ── Posting 1: Administrative Assistant ──────────────────────────────────────

const adminAssistantApplicants = [
  { first: "Ariana",  last: "Vale",  email: "ariana.vale@gmail.com",   phone: "+675 7201 0011", location: "Port Moresby, NCD",     years: "3",  status: "shortlisted" },
  { first: "Marcus",  last: "Moro",  email: "marcus.moro@gmail.com",   phone: "+675 7304 0022", location: "Lae, Morobe",            years: "2",  status: "new" },
  { first: "Leilani", last: "Kila",  email: "leilani.kila@outlook.com",phone: "+675 7102 0033", location: "Port Moresby, NCD",     years: "4",  status: "interview" },
  { first: "Tobias",  last: "Tane",  email: "tobias.tane@outlook.com", phone: "+675 7401 0044", location: "Madang",                years: "2",  status: "new" },
  { first: "Maya",    last: "Raka",  email: "maya.raka@gmail.com",     phone: "+675 7503 0055", location: "Port Moresby, NCD",     years: "5",  status: "offer" },
  { first: "Noah",    last: "Duma",  email: "noah.duma@gmail.com",     phone: "+675 7601 0066", location: "Goroka, EHP",           years: "1",  status: "rejected" },
  { first: "Elena",   last: "Sena",  email: "elena.sena@outlook.com",  phone: "+675 7702 0077", location: "Port Moresby, NCD",     years: "3",  status: "shortlisted" },
  { first: "Isaac",   last: "Boro",  email: "isaac.boro@gmail.com",    phone: "+675 7801 0088", location: "Wewak, ESP",            years: "2",  status: "new" },
  { first: "Sofia",   last: "Leka",  email: "sofia.leka@outlook.com",  phone: "+675 7903 0099", location: "Port Moresby, NCD",     years: "6",  status: "interview" },
  { first: "Daniel",  last: "Mati",  email: "daniel.mati@gmail.com",   phone: "+675 7001 0100", location: "Mount Hagen, WHP",      years: "2",  status: "new" },
];

// ── Posting 2: Software Support Specialist ───────────────────────────────────

const softwareSupportApplicants = [
  { first: "Grace",   last: "Vira",  email: "grace.vira@gmail.com",    phone: "+675 7211 1011", location: "Port Moresby, NCD",     years: "3",  status: "interview" },
  { first: "Lucas",   last: "Kane",  email: "lucas.kane@gmail.com",    phone: "+675 7314 1022", location: "Lae, Morobe",            years: "4",  status: "shortlisted" },
  { first: "Amara",   last: "Palu",  email: "amara.palu@outlook.com",  phone: "+675 7112 1033", location: "Port Moresby, NCD",     years: "2",  status: "new" },
  { first: "Ethan",   last: "Nero",  email: "ethan.nero@outlook.com",  phone: "+675 7411 1044", location: "Port Moresby, NCD",     years: "5",  status: "offer" },
  { first: "Nina",    last: "Savi",  email: "nina.savi@gmail.com",     phone: "+675 7513 1055", location: "Kokopo, ENB",           years: "3",  status: "shortlisted" },
  { first: "Caleb",   last: "Talo",  email: "caleb.talo@gmail.com",    phone: "+675 7611 1066", location: "Port Moresby, NCD",     years: "2",  status: "new" },
  { first: "Olivia",  last: "Rima",  email: "olivia.rima@outlook.com", phone: "+675 7712 1077", location: "Port Moresby, NCD",     years: "4",  status: "interview" },
  { first: "Jonah",   last: "Koto",  email: "jonah.koto@gmail.com",    phone: "+675 7811 1088", location: "Madang",                years: "1",  status: "rejected" },
  { first: "Lina",    last: "Lome",  email: "lina.lome@outlook.com",   phone: "+675 7913 1099", location: "Port Moresby, NCD",     years: "3",  status: "new" },
  { first: "Samuel",  last: "Tavi",  email: "samuel.tavi@gmail.com",   phone: "+675 7011 1100", location: "Port Moresby, NCD",     years: "6",  status: "shortlisted" },
];

// ── Posting definitions ───────────────────────────────────────────────────────

const postings = [
  {
    title: "Administrative Assistant",
    companyName: "Pacific Horizon Services",
    department: "Administration",
    industry: "Business Services",
    location: "Port Moresby, Papua New Guinea",
    employmentType: "Full-time",
    numHires: 1,
    salaryDisplay: "PGK 42,000 – PGK 55,000 per year",
    level: "Mid-level",
    closingDate: "2026-06-30",
    status: "published",
    approved: true,
    coverLetterRequired: true,
    featured: false,
    urgent: false,
    description: "Support office operations, reception, scheduling, records management, purchasing support, and day-to-day coordination for a growing service business.",
    responsibilities: "- Manage front desk, calls, visitor registration, and general inquiries\n- Coordinate calendars, meetings, travel bookings, and office logistics\n- Prepare correspondence, reports, purchase requests, and filing updates\n- Maintain office supplies, vendor records, and petty cash documentation\n- Support HR and finance teams with routine forms and records\n- Keep shared folders and physical files organised and current",
    requirements: "- Diploma or certificate in business administration, office management, or related field\n- 2+ years of office administration or reception experience\n- Strong written and verbal communication skills\n- Proficiency with Microsoft Word, Excel, email, and calendar tools\n- Ability to maintain confidentiality and accurate records\n- Professional customer service manner",
    folderName: "01_Administrative_Assistant",
    applicants: adminAssistantApplicants,
  },
  {
    title: "Software Support Specialist",
    companyName: "CoralTech Solutions",
    department: "Technical Support",
    industry: "Information Technology",
    location: "Port Moresby, Papua New Guinea (Hybrid)",
    employmentType: "Full-time",
    numHires: 1,
    salaryDisplay: "PGK 65,000 – PGK 85,000 per year",
    level: "Mid-level",
    closingDate: "2026-07-15",
    status: "published",
    approved: true,
    coverLetterRequired: true,
    featured: true,
    urgent: false,
    description: "Provide first- and second-level customer support for cloud software products, troubleshoot technical issues, document fixes, and coordinate escalations with product and engineering teams.",
    responsibilities: "- Respond to customer tickets by email, phone, chat, and remote session\n- Diagnose user, browser, account, configuration, and data issues\n- Document reproducible defects and escalate with clear evidence\n- Maintain knowledge base articles, support macros, and incident notes\n- Train customers on workflows, updates, and self-service tools\n- Track ticket trends and recommend product or process improvements",
    requirements: "- Diploma or degree in IT, information systems, computer science, or equivalent experience\n- 2+ years in software support, help desk, technical customer support, or systems administration\n- Working knowledge of Windows, browsers, SaaS platforms, APIs, basic SQL, and ticketing systems\n- Strong troubleshooting, documentation, and customer communication skills\n- Ability to prioritise tickets according to service levels\n- Comfort explaining technical concepts to non-technical users",
    folderName: "02_Software_Support_Specialist",
    applicants: softwareSupportApplicants,
  },
];

// ── Cover letter samples ──────────────────────────────────────────────────────

const coverLetterSamples = [
  "I am writing to express my strong interest in this position. With my background and experience, I am confident I would be a valuable addition to your team. I look forward to discussing how my skills align with your requirements.",
  "Please accept this letter as my formal application. I bring relevant experience and am eager to contribute to your organisation. Thank you for considering my application.",
  "I am excited to apply for this role. My experience has prepared me well for the responsibilities outlined in the job description. I am available for interview at your earliest convenience.",
  "Having researched your organisation, I am keen to join your team. I believe my qualifications and work ethic make me an excellent candidate. I would welcome the opportunity to discuss this further.",
  "I submit my application with enthusiasm. My background in the relevant field and my commitment to professional excellence make me a strong candidate for this position.",
];

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  console.log("=".repeat(60));
  console.log("HEYA Talent Dashboard — Dummy Data Seed");
  console.log("=".repeat(60));

  let totalApplications = 0;

  for (const posting of postings) {
    console.log(`\n📋 Creating posting: ${posting.title}`);

    // Create the job posting
    const created = careersDb.createJobPosting({
      title: posting.title,
      companyName: posting.companyName,
      department: posting.department,
      industry: posting.industry,
      location: posting.location,
      employmentType: posting.employmentType,
      numHires: posting.numHires,
      salaryDisplay: posting.salaryDisplay,
      level: posting.level,
      closingDate: posting.closingDate,
      status: posting.status,
      approved: posting.approved,
      coverLetterRequired: posting.coverLetterRequired,
      featured: posting.featured,
      urgent: posting.urgent,
      description: posting.description,
      responsibilities: posting.responsibilities,
      requirements: posting.requirements,
    });

    console.log(`   ✓ Posting created  id=${created.id}  ref=${created.referenceCode}`);

    const postingFolder = path.join(DUMMY_DIR, posting.folderName);

    // Create applications
    for (let i = 0; i < posting.applicants.length; i++) {
      const applicant = posting.applicants[i];
      const folderNum = String(i + 1).padStart(2, "0");
      const applicantFolder = path.join(
        postingFolder,
        `Applicant_${folderNum}_${applicant.first}_${applicant.last}`
      );

      const { cv, coverLetter } = docxPaths(applicantFolder, applicant.first, applicant.last);

      // Verify files exist
      if (!fs.existsSync(cv)) {
        console.warn(`   ⚠ CV not found: ${cv} — skipping ${applicant.first} ${applicant.last}`);
        continue;
      }

      const coverLetterSample = coverLetterSamples[i % coverLetterSamples.length];

      try {
        const application = careersDb.createJobApplication(created.id, {
          fullName: `${applicant.first} ${applicant.last}`,
          email: applicant.email,
          phone: applicant.phone,
          currentLocation: applicant.location,
          yearsExperience: applicant.years,
          message: coverLetterSample,
          sourcePath: "/careers",
          cvUpload: readUpload(cv),
          coverLetterUpload: fs.existsSync(coverLetter) ? readUpload(coverLetter) : undefined,
        });

        // Update status to something other than "new" if specified
        if (applicant.status !== "new") {
          careersDb.updateApplicationStatus(application.id, applicant.status);
        }

        console.log(`   ✓ ${applicant.first} ${applicant.last}  id=${application.id}  status=${applicant.status}`);
        totalApplications++;
      } catch (err) {
        console.error(`   ✗ Failed for ${applicant.first} ${applicant.last}: ${err.message}`);
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`Seed complete.`);
  console.log(`  Postings created : ${postings.length}`);
  console.log(`  Applications     : ${totalApplications}`);
  console.log("=".repeat(60));

  // Quick verification read
  console.log("\nVerification — first 5 applications in DB:");
  const all = careersDb.listApplications({ limit: 5, offset: 0 });
  (all.items || all).slice(0, 5).forEach((a) => {
    console.log(`  [${a.id}] ${a.fullName}  ${a.status}  ${a.positionTitle || a.jobTitle || ""}`);
  });
}

seed().catch((err) => {
  console.error("\nSeed script failed:", err);
  process.exit(1);
});
