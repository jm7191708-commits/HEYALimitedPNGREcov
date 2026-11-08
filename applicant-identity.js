import crypto from "crypto";

const cleanIdentityText = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const splitNameParts = (value) => cleanIdentityText(value)
  .split(" ")
  .map((part) => part.trim())
  .filter(Boolean);

export const getApplicantDisplayName = (applicant = {}) => {
  const directName = cleanIdentityText(applicant.fullName || applicant.name);
  if (directName) return directName;
  const parts = [
    cleanIdentityText(applicant.firstName),
    cleanIdentityText(applicant.lastName)
  ].filter(Boolean);
  return parts.join(" ") || "Unnamed Applicant";
};

export const createApplicantCode = () => `APL-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();

export const normalizeApplicantInput = (input = {}) => {
  const normalizedEmail = normalizeEmail(input.normalizedEmail || input.email);
  const fullName = cleanIdentityText(input.fullName || input.name);
  const explicitFirstName = cleanIdentityText(input.firstName);
  const explicitLastName = cleanIdentityText(input.lastName);
  const fullNameParts = splitNameParts(fullName);
  const firstName = explicitFirstName || fullNameParts[0] || "";
  const lastName = explicitLastName || (explicitFirstName ? cleanIdentityText(input.lastName) : fullNameParts.slice(1).join(" "));
  const displayName = fullName || getApplicantDisplayName({ firstName, lastName });

  return {
    id: input.id == null ? "" : String(input.id),
    applicantId: input.applicantId == null ? "" : String(input.applicantId),
    userId: input.userId == null ? "" : String(input.userId),
    applicationId: input.applicationId == null ? "" : String(input.applicationId),
    positionId: input.positionId == null ? "" : String(input.positionId),
    firstName,
    lastName,
    fullName: displayName,
    name: displayName,
    email: normalizedEmail || cleanIdentityText(input.email),
    normalizedEmail,
    phone: cleanIdentityText(input.phone),
    positionTitle: cleanIdentityText(input.positionTitle || input.jobTitle),
    status: cleanIdentityText(input.status),
    cvUrl: cleanIdentityText(input.cvUrl),
    resumeUrl: cleanIdentityText(input.resumeUrl),
    coverLetterUrl: cleanIdentityText(input.coverLetterUrl),
    coverLetterText: String(input.coverLetterText || "").trim(),
    skills: Array.isArray(input.skills) ? input.skills : [],
    experience: input.experience ?? input.yearsExperience ?? "",
    education: input.education ?? "",
    notes: input.notes ?? "",
    createdAt: input.createdAt || null,
    updatedAt: input.updatedAt || null
  };
};

export const getApplicantUniqueKey = (applicant = {}) => {
  const normalized = normalizeApplicantInput(applicant);
  if (normalized.normalizedEmail) return `email:${normalized.normalizedEmail}`;
  if (normalized.applicantId || normalized.id) return `applicant:${normalized.applicantId || normalized.id}`;
  return `name:${normalized.fullName}|phone:${normalized.phone}`;
};
