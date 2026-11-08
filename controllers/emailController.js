import sgMail from "@sendgrid/mail";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BANNER_URL = "http://cdn.mcauto-images-production.sendgrid.net/ddeb9514b26f02ed/15474cc9-c877-4815-a7e7-8f100d883f3e/1440x720.jpg";
const DEFAULT_BUSINESS_EMAIL = "admin@heya.com.pg";
const REQUIRED_EMAIL_DOMAIN = "heya.com.pg";
const TEMPLATE_NAMES = ["internal-notification", "customer-acknowledgment"];

const envValue = (key, fallback = "") => String(process.env[key] || fallback).trim();
const envFlag = (key) => /^(1|true|yes)$/i.test(envValue(key));
const isEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
const isEmailDeliveryEnabled = () => envFlag("SENDGRID_ENABLED");

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const templatePath = (templateName) => path.join(__dirname, "..", "email-templates", `${templateName}.html`);

const resolveBusinessEmail = () => {
  const candidates = [
    ["BUSINESS_EMAIL", envValue("BUSINESS_EMAIL")],
    ["EMAIL_TO_INTERNAL", envValue("EMAIL_TO_INTERNAL")],
    ["EMAIL_FROM", envValue("EMAIL_FROM")]
  ];

  const domainMatch = candidates.find(([, value]) => {
    const email = value.toLowerCase();
    return isEmailAddress(email) && email.endsWith(`@${REQUIRED_EMAIL_DOMAIN}`);
  });
  if (domainMatch) {
    return { email: domainMatch[1].toLowerCase(), source: domainMatch[0] };
  }

  const validWrongDomain = candidates.find(([, value]) => isEmailAddress(value));
  if (validWrongDomain) {
    console.warn(`[SendGrid] Ignoring ${validWrongDomain[0]} because it is not a ${REQUIRED_EMAIL_DOMAIN} address.`);
  }

  return { email: DEFAULT_BUSINESS_EMAIL, source: "default" };
};

export const getBusinessEmail = () => resolveBusinessEmail().email;

const getEmailConfig = () => {
  const businessEmail = resolveBusinessEmail();
  return {
    apiKey: envValue("SENDGRID_API_KEY"),
    fromEmail: businessEmail.email,
    fromName: envValue("EMAIL_FROM_NAME", "Heya Talent Solutions"),
    internalRecipient: businessEmail.email,
    internalFromName: envValue("EMAIL_INTERNAL_FROM_NAME", "Heya Talent Solutions Website"),
    bannerUrl: envValue("BANNER_URL", DEFAULT_BANNER_URL),
    subjectPrefix: envValue("EMAIL_SUBJECT_PREFIX", "Heya Talent Solutions"),
    sandboxMode: envFlag("SENDGRID_SANDBOX_MODE"),
    businessEmailSource: businessEmail.source
  };
};

const renderTemplate = (templateName, data) => {
  try {
    const template = fs.readFileSync(templatePath(templateName), "utf8");
    return template
      .replace(/{{{unsubscribe}}}/g, "#")
      .replace(/{{{unsubscribe_preferences}}}/g, "#")
      .replace(/{{([a-zA-Z0-9_]+)}}/g, (_match, key) => escapeHtml(data[key] || "N/A"));
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    return `<p>Email template unavailable. Request ID: ${escapeHtml(data.request_id || "N/A")}</p>`;
  }
};

const normalizeType = (type) => (type === "vacancy" ? "vacancy" : "contact");
const optionalValue = (value, fallback = "Not provided") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const buildInternalSubmissionData = (formData, isVacancy, requestId, submittedAt, bannerUrl) => {
  const requestedService = isVacancy
    ? (formData.jobTitle || "Vacancy / Hiring Support")
    : (formData.serviceNeeded || "General Enquiry");

  const hiringNeed = isVacancy
    ? [
        formData.jobTitle && `Position: ${formData.jobTitle}`,
        formData.industry && `Industry: ${formData.industry}`,
        formData.location && `Location: ${formData.location}`,
        formData.employmentType && `Employment Type: ${formData.employmentType}`
      ].filter(Boolean).join(" | ")
    : (formData.message || "General contact enquiry");

  return {
    request_id: requestId,
    submitted_at: submittedAt,
    form_type: isVacancy ? "Vacancy / Hiring Enquiry" : "Contact / Service Enquiry",
    company_name: optionalValue(formData.companyName),
    contact_name: optionalValue(formData.fullName),
    contact_email: optionalValue(formData.email),
    contact_phone: optionalValue(formData.phone),
    requested_service: requestedService,
    hiring_need: optionalValue(hiringNeed),
    number_of_roles: isVacancy ? optionalValue(formData.numberOfVacancies) : "Not specified for contact enquiry",
    timeline: isVacancy ? optionalValue(formData.employmentType) : "Not specified for contact enquiry",
    budget: optionalValue(formData.packageInterest, "No package selected"),
    message: optionalValue(formData.message),
    consent_status: "Website submission received",
    source_path: optionalValue(formData.sourcePath),
    ip_address: optionalValue(formData.ipAddress),
    user_agent: optionalValue(formData.userAgent),
    banner_image_url: bannerUrl
  };
};

export const getEmailConfigStatus = () => {
  const config = getEmailConfig();
  const enabled = isEmailDeliveryEnabled();
  const validMailboxConfig = isEmailAddress(config.fromEmail) && isEmailAddress(config.internalRecipient);
  return {
    enabled,
    configured: Boolean(enabled && config.apiKey && validMailboxConfig),
    apiKeyConfigured: Boolean(config.apiKey),
    apiKeySource: "SENDGRID_API_KEY",
    businessEmailSource: config.businessEmailSource,
    fromEmail: config.fromEmail,
    internalRecipient: config.internalRecipient,
    businessEmailValid: validMailboxConfig,
    sandboxMode: config.sandboxMode,
    templates: TEMPLATE_NAMES.map((name) => ({
      name,
      exists: fs.existsSync(templatePath(name))
    }))
  };
};

export const buildEnquiryEmailMessages = (formData, type = "contact") => {
  const config = getEmailConfig();
  const emailType = normalizeType(type);
  const isVacancy = emailType === "vacancy";
  const requestId = formData.id || "N/A";
  const submittedAt = new Date().toLocaleString("en-PG", { timeZone: "Pacific/Port_Moresby" });
  const customerEmail = optionalValue(formData.email, "");
  const customerName = optionalValue(formData.fullName, "Website Customer");
  const internalData = buildInternalSubmissionData(formData, isVacancy, requestId, submittedAt, config.bannerUrl);

  const customerData = {
    contact_name: formData.fullName || "Valued Customer",
    request_id: requestId,
    company_name: formData.companyName || "N/A",
    requested_service: internalData.requested_service,
    timeline: internalData.timeline,
    submitted_at: submittedAt,
    banner_image_url: config.bannerUrl,
    business_email: config.fromEmail
  };

  const sendgridOptions = config.sandboxMode
    ? { mailSettings: { sandboxMode: { enable: true } } }
    : {};

  return [
    {
      to: {
        email: config.internalRecipient,
        name: "HEYA Limited"
      },
      from: {
        email: config.fromEmail,
        name: config.internalFromName
      },
      ...(customerEmail ? { replyTo: { email: customerEmail, name: customerName } } : {}),
      subject: `[${config.subjectPrefix} Website] ${internalData.form_type} - ${internalData.company_name}`,
      html: renderTemplate("internal-notification", internalData),
      ...sendgridOptions
    },
    {
      to: {
        email: customerEmail,
        name: customerName
      },
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      subject: `${config.subjectPrefix}: We Received Your ${isVacancy ? "Vacancy Enquiry" : "Enquiry"}`,
      html: renderTemplate("customer-acknowledgment", customerData),
      ...sendgridOptions
    }
  ];
};

export const sendEnquiryEmails = async (formData, type = "contact") => {
  const config = getEmailConfig();
  const status = getEmailConfigStatus();

  if (!status.enabled) {
    console.warn("SendGrid delivery is disabled by SENDGRID_ENABLED. Skipping email sending.");
    return { ok: true, skipped: true, reason: "disabled", status };
  }

  if (!status.configured) {
    console.warn("SendGrid is not fully configured. Skipping email sending.");
    return { ok: true, skipped: true, reason: "not_configured", status };
  }

  const messages = buildEnquiryEmailMessages(formData, type);

  try {
    console.log(`[SendGrid] Config: apiKeyConfigured=${Boolean(config.apiKey)}, from=${config.fromEmail}, internalRecipient=${config.internalRecipient}, sandbox=${config.sandboxMode}`);
    sgMail.setApiKey(config.apiKey);
    await sgMail.send(messages);
    console.log(`[SendGrid] Emails successfully sent for Request ID: ${formData.id || "N/A"}`);
    return { ok: true, skipped: false, messageCount: messages.length };
  } catch (error) {
    console.error("[SendGrid] Error sending emails:", error?.message || error);
    if (error.response) {
      console.error(error.response.body);
    }
    return { ok: false, skipped: false, error: error?.message || "sendgrid_error" };
  }
};

export const sendCareersMailboxNotification = async ({
  toEmail,
  subject,
  heading,
  rows = [],
  replyTo,
  customerEmail,
  customerName,
  acknowledgmentSubject,
  acknowledgmentMessage
} = {}) => {
  const status = getEmailConfigStatus();
  const config = getEmailConfig();

  if (!status.enabled) {
    console.warn("SendGrid delivery is disabled by SENDGRID_ENABLED. Skipping careers email sending.");
    return { ok: true, skipped: true, reason: "disabled", status };
  }

  if (!status.configured) {
    return { ok: true, skipped: true, reason: "not_configured", status };
  }

  const internalRecipient = isEmailAddress(toEmail) ? toEmail : config.internalRecipient;
  const detailRows = rows
    .filter((row) => row && row.label)
    .map((row) => `<tr><td style="padding:8px 10px;border:1px solid #e5e5e5;font-weight:600;">${escapeHtml(row.label)}</td><td style="padding:8px 10px;border:1px solid #e5e5e5;">${escapeHtml(row.value || "N/A")}</td></tr>`)
    .join("");

  const messages = [
    {
      to: { email: internalRecipient, name: "HEYA Careers" },
      from: { email: config.fromEmail, name: config.internalFromName },
      ...(isEmailAddress(replyTo?.email) ? { replyTo } : {}),
      subject: subject || `${config.subjectPrefix}: Careers notification`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <h2 style="margin-bottom:12px;">${escapeHtml(heading || "Careers submission received")}</h2>
          <table style="border-collapse:collapse;width:100%;max-width:760px;">${detailRows}</table>
        </div>
      `
    }
  ];

  if (isEmailAddress(customerEmail) && acknowledgmentSubject && acknowledgmentMessage) {
    messages.push({
      to: { email: customerEmail, name: customerName || "Candidate" },
      from: { email: config.fromEmail, name: config.fromName },
      subject: acknowledgmentSubject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <p>${escapeHtml(customerName || "Hello")},</p>
          <p>${escapeHtml(acknowledgmentMessage)}</p>
          <p>You can reply to this email if you need to share anything further.</p>
        </div>
      `
    });
  }

  try {
    sgMail.setApiKey(config.apiKey);
    await sgMail.send(messages);
    return { ok: true, skipped: false, messageCount: messages.length };
  } catch (error) {
    console.error("[SendGrid] Careers email error:", error?.message || error);
    if (error.response) {
      console.error(error.response.body);
    }
    return { ok: false, skipped: false, error: error?.message || "sendgrid_error" };
  }
};
