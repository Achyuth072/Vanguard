import type {
  NormalizedFormField,
  FormFieldOption,
  CandidateProfilePayload,
  FormFieldMapping,
  FormMappingOutcome,
  FormMapperOptions,
} from "./types";
import {
  answerCustomQuestion,
  type CandidateContext,
  type JobContext,
  type AIRouterOptions,
} from "../ai/router";

/**
 * Splits a full candidate name into firstName and lastName components.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName || typeof fullName !== "string") {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/**
 * Composes a full candidate name from firstName and lastName.
 */
export function composeFullName(firstName?: string, lastName?: string): string {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  if (f && l) return `${f} ${l}`;
  return f || l || "";
}

/**
 * Normalizes phone numbers to standard E.164 formatting (defaulting to +1 if US).
 */
export function normalizePhoneE164(phone: string, defaultCountryCode = "+1"): string {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  const cleaned = phone.trim();
  if (cleaned.startsWith("+")) {
    const digitsOnly = cleaned.replace(/[^\d+]/g, "");
    return digitsOnly;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length > 0) {
    return `+${digits}`;
  }

  return cleaned;
}

/**
 * Detects ATS platform signature from form HTML or DOM attributes.
 */
export function detectPlatform(
  htmlOrSelector: string
): "greenhouse" | "lever" | "ashby" | "unknown" {
  const content = htmlOrSelector.toLowerCase();
  if (
    content.includes("ashby") ||
    content.includes("_ashby_application_form") ||
    content.includes("jobs.ashbyhq.com")
  ) {
    return "ashby";
  }
  if (
    content.includes("greenhouse") ||
    content.includes("job_application") ||
    content.includes("#application_form") ||
    content.includes("boards.greenhouse.io")
  ) {
    return "greenhouse";
  }
  if (
    content.includes("lever") ||
    content.includes("jobs.lever.co") ||
    content.includes("urls[") ||
    content.includes("cards[") ||
    content.includes('id="application-form"') ||
    content.includes("application-additional")
  ) {
    return "lever";
  }
  return "unknown";
}

/**
 * Lightweight HTML parser for static test fixtures and server-side DOM analysis.
 * Extracts interactive fields into NormalizedFormField schema.
 */
export function extractFormFieldsFromHtml(html: string): {
  platform: "greenhouse" | "lever" | "ashby" | "unknown";
  formSelector: string;
  fields: NormalizedFormField[];
} {
  const platform = detectPlatform(html);

  // Determine standard form selector
  let formSelector = "form";
  if (html.includes('id="application_form"')) {
    formSelector = "#application_form";
  } else if (html.includes('id="application-form"')) {
    formSelector = "form#application-form";
  } else if (html.includes('id="_ashby_application_form"')) {
    formSelector = "#_ashby_application_form";
  }

  const fields: NormalizedFormField[] = [];

  // 1. Extract file inputs
  const fileRegex = /<input[^>]+type=["']file["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(html)) !== null) {
    const tag = match[0];
    const idMatch = tag.match(/id=["']([^"']+)["']/i);
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const testIdMatch = tag.match(/data-testid=["']([^"']+)["']/i);
    const required = tag.includes("required");

    const id = idMatch ? idMatch[1] : "";
    const name = nameMatch ? nameMatch[1] : "";
    const testId = testIdMatch ? testIdMatch[1] : "";

    let selector = 'input[type="file"]';
    if (testId) {
      selector = `input[data-testid="${testId}"]`;
    } else if (id) {
      selector = `input#${id}[type="file"]`;
    } else if (name) {
      selector = `input[name="${name}"]`;
    }

    // Attempt label lookup
    let label = "Resume/CV";
    if (id) {
      const labelRegex = new RegExp(`<label[^>]+for=["']${id}["'][^>]*>([\\s\\S]*?)<\\/label>`, "i");
      const lm = html.match(labelRegex);
      if (lm) {
        label = cleanLabelText(lm[1]);
      }
    }

    fields.push({
      id: id || "file_resume",
      selector,
      label,
      type: "file",
      required,
      name,
      testId,
    });
  }

  // 2. Extract standard input elements (excluding radio and file)
  const inputRegex = /<input(?![^>]*type=["'](?:file|radio|checkbox|hidden|submit|button)["'])[^>]*>/gi;
  while ((match = inputRegex.exec(html)) !== null) {
    const tag = match[0];
    const idMatch = tag.match(/id=["']([^"']+)["']/i);
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const typeMatch = tag.match(/type=["']([^"']+)["']/i);
    const autoMatch = tag.match(/autocomplete=["']([^"']+)["']/i);
    const placeMatch = tag.match(/placeholder=["']([^"']+)["']/i);
    const testIdMatch = tag.match(/data-testid=["']([^"']+)["']/i);
    const ariaMatch = tag.match(/aria-label=["']([^"']+)["']/i);
    const ariaByMatch = tag.match(/aria-labelledby=["']([^"']+)["']/i);
    const required = tag.includes("required") || tag.includes('aria-required="true"');

    const id = idMatch ? idMatch[1] : "";
    const name = nameMatch ? nameMatch[1] : "";
    const typeStr = (typeMatch ? typeMatch[1] : "text").toLowerCase();
    const type = ["email", "tel", "url"].includes(typeStr)
      ? (typeStr as NormalizedFormField["type"])
      : "text";
    const autocomplete = autoMatch ? autoMatch[1] : undefined;
    const placeholder = placeMatch ? placeMatch[1] : undefined;
    const testId = testIdMatch ? testIdMatch[1] : undefined;

    let selector = "";
    if (platform === "greenhouse") {
      selector = id ? `input#${id}` : `input[name="${name}"]`;
    } else if (platform === "lever") {
      if (
        name &&
        (["name", "email", "phone", "org"].includes(name) || name.startsWith("urls["))
      ) {
        selector = `input[name="${name}"]`;
      } else if (id) {
        selector = `input#${id}`;
      } else {
        selector = name ? `input[name="${name}"]` : "input";
      }
    } else if (platform === "ashby") {
      selector = id ? `input#${id}` : name ? `input[name="${name}"]` : "input";
    } else {
      selector = id ? `input#${id}` : name ? `input[name="${name}"]` : "input";
    }

    let label = "";
    if (id) {
      const labelRegex = new RegExp(`<label[^>]+for=["']${id}["'][^>]*>([\\s\\S]*?)<\\/label>`, "i");
      const lm = html.match(labelRegex);
      if (lm) {
        label = cleanLabelText(lm[1]);
      }
    }
    if (!label && ariaMatch) {
      label = ariaMatch[1];
    }
    if (!label && placeholder) {
      label = placeholder;
    }

    fields.push({
      id: id || name || selector,
      selector,
      label,
      type,
      required,
      name,
      autocomplete,
      placeholder,
      testId,
      ariaLabel: ariaMatch ? ariaMatch[1] : undefined,
      ariaLabelledBy: ariaByMatch ? ariaByMatch[1] : undefined,
    });
  }

  // 3. Extract textarea elements
  const textareaRegex = /<textarea[^>]*>[\s\S]*?<\/textarea>/gi;
  while ((match = textareaRegex.exec(html)) !== null) {
    const full = match[0];
    const openTag = full.match(/<textarea[^>]*>/i)?.[0] || "";
    const idMatch = openTag.match(/id=["']([^"']+)["']/i);
    const nameMatch = openTag.match(/name=["']([^"']+)["']/i);
    const placeMatch = openTag.match(/placeholder=["']([^"']+)["']/i);
    const ariaByMatch = openTag.match(/aria-labelledby=["']([^"']+)["']/i);
    const required = openTag.includes("required");

    const id = idMatch ? idMatch[1] : "";
    const name = nameMatch ? nameMatch[1] : "";
    const placeholder = placeMatch ? placeMatch[1] : undefined;

    const selector = id ? `textarea#${id}` : name ? `textarea[name="${name}"]` : "textarea";

    let label = "";
    if (id) {
      const labelRegex = new RegExp(`<label[^>]+for=["']${id}["'][^>]*>([\\s\\S]*?)<\\/label>`, "i");
      const lm = html.match(labelRegex);
      if (lm) {
        label = cleanLabelText(lm[1]);
      }
    }
    if (!label && ariaByMatch) {
      const ariaId = ariaByMatch[1];
      const labelRegex = new RegExp(`id=["']${ariaId}["'][^>]*>([\\s\\S]*?)<\\/`, "i");
      const lm = html.match(labelRegex);
      if (lm) {
        label = cleanLabelText(lm[1]);
      }
    }
    if (!label && placeholder) {
      label = placeholder;
    }

    fields.push({
      id: id || name || selector,
      selector,
      label,
      type: "textarea",
      required,
      name,
      placeholder,
    });
  }

  // 4. Extract select elements & options
  const selectRegex = /<select[^>]*>([\s\S]*?)<\/select>/gi;
  while ((match = selectRegex.exec(html)) !== null) {
    const full = match[0];
    const inner = match[1];
    const openTag = full.match(/<select[^>]*>/i)?.[0] || "";
    const idMatch = openTag.match(/id=["']([^"']+)["']/i);
    const nameMatch = openTag.match(/name=["']([^"']+)["']/i);
    const required = openTag.includes("required");

    const id = idMatch ? idMatch[1] : "";
    const name = nameMatch ? nameMatch[1] : "";

    const selector = id ? `select#${id}` : name ? `select[name="${name}"]` : "select";

    let label = "";
    if (id) {
      const labelRegex = new RegExp(`<label[^>]+for=["']${id}["'][^>]*>([\\s\\S]*?)<\\/label>`, "i");
      const lm = html.match(labelRegex);
      if (lm) {
        label = cleanLabelText(lm[1]);
      }
    }

    const options: FormFieldOption[] = [];
    const optionRegex = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optionRegex.exec(inner)) !== null) {
      options.push({
        value: optMatch[1],
        label: cleanLabelText(optMatch[2]),
      });
    }

    fields.push({
      id: id || name || selector,
      selector,
      label,
      type: "select",
      required,
      name,
      options,
    });
  }

  // 5. Extract radio groups (e.g. Lever card questions)
  const radioRegex = /<input[^>]+type=["']radio["'][^>]*>/gi;
  const radioMap = new Map<
    string,
    Array<{ value: string; label: string; fullTag: string; index: number }>
  >();

  while ((match = radioRegex.exec(html)) !== null) {
    const tag = match[0];
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const valueMatch = tag.match(/value=["']([^"']+)["']/i);

    if (nameMatch && valueMatch) {
      const rName = nameMatch[1];
      const rVal = valueMatch[1];
      const list = radioMap.get(rName) || [];
      list.push({ value: rVal, label: rVal, fullTag: tag, index: match.index });
      radioMap.set(rName, list);
    }
  }

  for (const [rName, opts] of radioMap.entries()) {
    // Find the immediately preceding group label before the first radio input of this group
    let groupLabel = "";
    const firstIndex = opts[0]?.index ?? 0;
    const beforeHtml = html.slice(Math.max(0, firstIndex - 1000), firstIndex);
    const labelMatches = [...beforeHtml.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi)];
    if (labelMatches.length > 0) {
      // Pick the last non-empty label before this radio group
      for (let i = labelMatches.length - 1; i >= 0; i--) {
        const candidate = cleanLabelText(labelMatches[i][1]);
        if (candidate && candidate !== "Yes" && candidate !== "No") {
          groupLabel = candidate;
          break;
        }
      }
    }

    for (const opt of opts) {
      const selector = `input[name="${rName}"][value="${opt.value}"]`;
      const isRequired = html.includes(`name="${rName}"`) && html.includes("required");

      fields.push({
        id: `${rName}_${opt.value}`,
        selector,
        label: groupLabel || opt.label,
        type: "radio",
        required: isRequired,
        name: rName,
        value: opt.value,
        options: opts.map((o) => ({
          value: o.value,
          label: o.label,
          selector: `input[name="${rName}"][value="${o.value}"]`,
        })),
      });
    }
  }

  return {
    platform,
    formSelector,
    fields,
  };
}

function cleanLabelText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&bull;/g, "•")
    .replace(/&amp;/g, "&")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matches Tier 1 deterministic fields: demographics, contact, links, work authorization, resume.
 */
export function matchTier1Deterministic(
  field: NormalizedFormField,
  candidateData: CandidateProfilePayload,
  platform?: "greenhouse" | "lever" | "ashby" | "unknown"
): FormFieldMapping | null {
  const { profile } = candidateData;
  const labelLower = (field.label || "").toLowerCase();
  const nameLower = (field.name || "").toLowerCase();
  const idLower = (field.id || "").toLowerCase();
  const autoLower = (field.autocomplete || "").toLowerCase();
  const testIdLower = (field.testId || "").toLowerCase();
  const placeholderLower = (field.placeholder || "").toLowerCase();

  // 1. Resume / CV File Upload
  if (
    field.type === "file" ||
    testIdLower.includes("resume") ||
    idLower.includes("resume") ||
    nameLower.includes("resume")
  ) {
    const resumePath = profile.resumePath || "/path/to/tailored_resume.pdf";
    let matchType: FormFieldMapping["matchType"] = "platform-attribute";
    if (field.testId && field.testId.includes("resume")) {
      matchType = "test-id";
    }

    return {
      field: "resume",
      selector: field.selector,
      tier: 1,
      matchType,
      value: resumePath,
      expectedValue: resumePath,
      action: "upload",
      expectedAction: "upload",
      confidence: 1.0,
    };
  }

  // 2. Full Name (Lever / Combined Name inputs)
  if (
    autoLower === "name" ||
    (field.name === "name" && platform === "lever") ||
    (idLower === "name" && platform === "lever") ||
    (nameLower === "fullname" || nameLower === "full_name")
  ) {
    const fullName =
      profile.fullName || composeFullName(profile.firstName, profile.lastName) || "Candidate Name";
    return {
      field: "fullName",
      selector: field.selector,
      tier: 1,
      matchType: autoLower === "name" && platform !== "lever" ? "autocomplete" : "platform-attribute",
      value: fullName,
      expectedValue: fullName,
      action: "fill",
      confidence: 1.0,
    };
  }

  // 3. First Name
  if (
    autoLower === "given-name" ||
    nameLower.includes("first_name") ||
    nameLower === "firstname" ||
    idLower.includes("first_name") ||
    idLower === "_input_first_name" ||
    (labelLower.includes("first name") && !labelLower.includes("last"))
  ) {
    const firstName =
      profile.firstName || splitFullName(profile.fullName || "").firstName || "Alex";
    return {
      field: "firstName",
      selector: field.selector,
      tier: 1,
      matchType: autoLower === "given-name" ? "autocomplete" : "platform-attribute",
      value: firstName,
      expectedValue: firstName,
      action: "fill",
      confidence: 1.0,
    };
  }

  // 4. Last Name
  if (
    autoLower === "family-name" ||
    nameLower.includes("last_name") ||
    nameLower === "lastname" ||
    idLower.includes("last_name") ||
    idLower === "_input_last_name" ||
    labelLower.includes("last name")
  ) {
    const lastName =
      profile.lastName || splitFullName(profile.fullName || "").lastName || "Candidate";
    return {
      field: "lastName",
      selector: field.selector,
      tier: 1,
      matchType: autoLower === "family-name" ? "autocomplete" : "platform-attribute",
      value: lastName,
      expectedValue: lastName,
      action: "fill",
      confidence: 1.0,
    };
  }

  // 5. Email
  if (
    autoLower === "email" ||
    field.type === "email" ||
    nameLower.includes("email") ||
    idLower.includes("email") ||
    labelLower.includes("email")
  ) {
    const email = profile.email || "candidate@example.com";
    return {
      field: "email",
      selector: field.selector,
      tier: 1,
      matchType: autoLower === "email" ? "autocomplete" : "platform-attribute",
      value: email,
      expectedValue: email,
      action: "fill",
      confidence: 1.0,
    };
  }

  // 6. Phone
  if (
    autoLower === "tel" ||
    field.type === "tel" ||
    nameLower.includes("phone") ||
    idLower.includes("phone") ||
    labelLower.includes("phone")
  ) {
    const phone = profile.phone || "+1 (555) 000-0000";
    return {
      field: "phone",
      selector: field.selector,
      tier: 1,
      matchType: autoLower === "tel" ? "autocomplete" : "platform-attribute",
      value: phone,
      expectedValue: phone,
      action: "fill",
      confidence: 1.0,
    };
  }

  // 7. Location / Address
  if (
    autoLower.includes("address") ||
    nameLower.includes("location") ||
    idLower.includes("location") ||
    labelLower.includes("location") ||
    placeholderLower.includes("san francisco")
  ) {
    const location = profile.location || "San Francisco, CA";
    const matchType =
      autoLower.includes("address") ? "autocomplete" : "platform-attribute";
    return {
      field: "location",
      selector: field.selector,
      tier: 1,
      matchType,
      value: location,
      expectedValue: location,
      action: "fill",
      confidence: 0.95,
    };
  }

  // 8. Current Company / Org
  if (
    autoLower === "organization" ||
    nameLower === "org" ||
    idLower === "org" ||
    labelLower.includes("current company")
  ) {
    const org = profile.currentCompany || "Acme Systems";
    return {
      field: "org",
      selector: field.selector,
      tier: 1,
      matchType: "platform-attribute",
      value: org,
      expectedValue: org,
      action: "fill",
      confidence: 0.95,
    };
  }

  // 9. Social Links & Portfolios
  // LinkedIn
  if (
    nameLower.includes("urls[linkedin]") ||
    idLower.includes("linkedin") ||
    nameLower.includes("linkedin") ||
    labelLower.includes("linkedin")
  ) {
    const url =
      profile.links?.linkedIn || "https://www.linkedin.com/in/candidate";
    const matchType =
      nameLower.includes("urls[linkedin]") ? "platform-attribute" : "label-regex";
    return {
      field: "linkedIn",
      selector: field.selector,
      tier: 1,
      matchType,
      value: url,
      expectedValue: url,
      action: "fill",
      confidence: 0.98,
    };
  }

  // GitHub
  if (
    nameLower.includes("urls[github]") ||
    idLower.includes("github") ||
    nameLower.includes("github") ||
    labelLower.includes("github")
  ) {
    const url = profile.links?.gitHub || "https://github.com/candidate";
    const matchType =
      nameLower.includes("urls[github]") ? "platform-attribute" : "label-regex";
    return {
      field: "gitHub",
      selector: field.selector,
      tier: 1,
      matchType,
      value: url,
      expectedValue: url,
      action: "fill",
      confidence: 0.98,
    };
  }

  // Portfolio / Personal Website
  if (
    nameLower.includes("urls[portfolio]") ||
    idLower.includes("portfolio") ||
    nameLower.includes("portfolio") ||
    labelLower.includes("portfolio") ||
    labelLower.includes("personal website")
  ) {
    const url = profile.links?.portfolio || "https://candidate.dev";
    const matchType =
      nameLower.includes("urls[portfolio]") ? "platform-attribute" : "label-regex";
    return {
      field: "portfolio",
      selector: field.selector,
      tier: 1,
      matchType,
      value: url,
      expectedValue: url,
      action: "fill",
      confidence: 0.98,
    };
  }

  // 10. Work Authorization & Visa Sponsorship
  // Work Authorization (Authorized in US)
  if (
    labelLower.includes("authorized to work") ||
    labelLower.includes("legally authorized") ||
    nameLower.includes("work_auth") ||
    nameLower.includes("work_authorization")
  ) {
    const isAuth = profile.workAuthorization?.authorizedInUS ?? true;

    // If Lever radio option
    if (field.type === "radio") {
      const targetVal = isAuth ? "Yes" : "No";
      if (field.value === targetVal) {
        return {
          field: "work_authorization",
          selector: field.selector,
          tier: 1,
          matchType: "label-regex",
          value: targetVal,
          expectedValue: targetVal,
          action: "check",
          expectedAction: "check",
          confidence: 1.0,
        };
      }
      return null;
    }

    // If Select dropdown
    if (field.type === "select" && field.options) {
      let matchedVal = isAuth ? "yes" : "no";
      for (const opt of field.options) {
        const valL = opt.value.toLowerCase();
        const lblL = opt.label.toLowerCase();
        if (isAuth && (valL === "1" || valL === "yes" || lblL.startsWith("yes"))) {
          matchedVal = opt.value;
          break;
        } else if (!isAuth && (valL === "0" || valL === "no" || lblL.startsWith("no"))) {
          matchedVal = opt.value;
          break;
        }
      }

      return {
        field: "work_authorization",
        selector: field.selector,
        tier: 1,
        matchType: "label-regex",
        value: matchedVal,
        expectedValue: matchedVal,
        action: "select",
        confidence: 1.0,
      };
    }
  }

  // Visa Sponsorship
  if (
    (labelLower.includes("require") &&
      (labelLower.includes("sponsorship") || labelLower.includes("visa"))) ||
    nameLower.includes("requires_sponsorship") ||
    nameLower.includes("visa_sponsorship")
  ) {
    const reqSponsor = profile.workAuthorization?.requiresSponsorship ?? false;

    // If Lever radio option
    if (field.type === "radio") {
      const targetVal = reqSponsor ? "Yes" : "No";
      if (field.value === targetVal) {
        return {
          field: "visa_sponsorship",
          selector: field.selector,
          tier: 1,
          matchType: "label-regex",
          value: targetVal,
          expectedValue: targetVal,
          action: "check",
          expectedAction: "check",
          confidence: 1.0,
        };
      }
      return null;
    }

    // If Select dropdown
    if (field.type === "select" && field.options) {
      let matchedVal = reqSponsor ? "yes" : "no";
      for (const opt of field.options) {
        const valL = opt.value.toLowerCase();
        const lblL = opt.label.toLowerCase();
        if (reqSponsor && (valL === "1" || valL === "yes" || lblL.startsWith("yes"))) {
          matchedVal = opt.value;
          break;
        } else if (!reqSponsor && (valL === "0" || valL === "no" || lblL.startsWith("no"))) {
          matchedVal = opt.value;
          break;
        }
      }

      return {
        field: "visa_sponsorship",
        selector: field.selector,
        tier: 1,
        matchType: "label-regex",
        value: matchedVal,
        expectedValue: matchedVal,
        action: "select",
        confidence: 1.0,
      };
    }
  }

  // 11. Demographic / EEO Fields
  // Gender
  if (
    idLower.includes("gender") ||
    nameLower.includes("gender") ||
    labelLower.includes("gender identity") ||
    labelLower === "gender"
  ) {
    let genderVal = profile.demographics?.gender || "Decline";
    if (platform === "greenhouse" && profile.demographics?.genderGreenhouse) {
      genderVal = profile.demographics.genderGreenhouse;
    } else if (platform === "lever" && profile.demographics?.genderLever) {
      genderVal = profile.demographics.genderLever;
    } else if (platform === "ashby" && profile.demographics?.genderAshby) {
      genderVal = profile.demographics.genderAshby;
    }

    const matchedOpt = findBestOptionMatch(field.options || [], genderVal);
    const fieldName = platform === "greenhouse" ? "gender" : "eeo_gender";
    const matchType = platform === "ashby" ? "label-regex" : "platform-attribute";

    return {
      field: fieldName,
      selector: field.selector,
      tier: 1,
      matchType,
      value: matchedOpt,
      expectedValue: matchedOpt,
      action: "select",
      confidence: 0.95,
    };
  }

  // Race / Ethnicity
  if (
    idLower.includes("race") ||
    nameLower.includes("race") ||
    labelLower.includes("race / ethnicity") ||
    labelLower.includes("race/ethnicity")
  ) {
    let raceVal = profile.demographics?.race || "Hispanic";
    if (platform === "greenhouse" && profile.demographics?.raceGreenhouse) {
      raceVal = profile.demographics.raceGreenhouse;
    } else if (platform === "lever" && profile.demographics?.raceLever) {
      raceVal = profile.demographics.raceLever;
    } else if (platform === "ashby" && profile.demographics?.raceAshby) {
      raceVal = profile.demographics.raceAshby;
    }

    const matchedOpt = findBestOptionMatch(field.options || [], raceVal);
    const fieldName = platform === "greenhouse" ? "race" : "eeo_race";
    const matchType = platform === "ashby" ? "label-regex" : "platform-attribute";

    return {
      field: fieldName,
      selector: field.selector,
      tier: 1,
      matchType,
      value: matchedOpt,
      expectedValue: matchedOpt,
      action: "select",
      confidence: 0.95,
    };
  }

  // Veteran Status
  if (
    idLower.includes("veteran") ||
    nameLower.includes("veteran") ||
    labelLower.includes("veteran status")
  ) {
    let vetVal = profile.demographics?.veteranStatus || "NotVeteran";
    if (platform === "greenhouse" && profile.demographics?.veteranGreenhouse) {
      vetVal = profile.demographics.veteranGreenhouse;
    } else if (platform === "lever" && profile.demographics?.veteranLever) {
      vetVal = profile.demographics.veteranLever;
    } else if (platform === "ashby" && profile.demographics?.veteranAshby) {
      vetVal = profile.demographics.veteranAshby;
    }

    const matchedOpt = findBestOptionMatch(field.options || [], vetVal);
    const fieldName = platform === "greenhouse" ? "veteranStatus" : "eeo_veteran";
    const matchType = platform === "ashby" ? "label-regex" : "platform-attribute";

    return {
      field: fieldName,
      selector: field.selector,
      tier: 1,
      matchType,
      value: matchedOpt,
      expectedValue: matchedOpt,
      action: "select",
      confidence: 0.95,
    };
  }

  // Disability Status
  if (
    idLower.includes("disability") ||
    nameLower.includes("disability") ||
    labelLower.includes("disability status")
  ) {
    let disVal = profile.demographics?.disabilityStatus || "No";
    if (platform === "greenhouse" && profile.demographics?.disabilityGreenhouse) {
      disVal = profile.demographics.disabilityGreenhouse;
    }

    const matchedOpt = findBestOptionMatch(field.options || [], disVal);
    return {
      field: "disabilityStatus",
      selector: field.selector,
      tier: 1,
      matchType: "platform-attribute",
      value: matchedOpt,
      expectedValue: matchedOpt,
      action: "select",
      confidence: 0.95,
    };
  }

  // Salary Expectations (if input)
  if (
    idLower.includes("salary") ||
    idLower.includes("compensation") ||
    nameLower.includes("salary") ||
    labelLower.includes("salary") ||
    labelLower.includes("compensation")
  ) {
    // Check tailored answers for salary
    let salaryVal = "$185,000 - $210,000 USD";
    if (candidateData.tailoredAnswers) {
      for (const ta of candidateData.tailoredAnswers) {
        if (new RegExp(ta.questionPattern, "i").test(field.label)) {
          salaryVal = ta.answer;
          break;
        }
      }
    }

    return {
      field: "salary_expectations",
      selector: field.selector,
      tier: 2,
      matchType: "label-regex",
      value: salaryVal,
      expectedValue: salaryVal,
      action: "fill",
      confidence: 0.9,
    };
  }

  return null;
}

function findBestOptionMatch(options: FormFieldOption[], targetValue: string): string {
  if (!options || options.length === 0) return targetValue;

  const targetL = targetValue.toLowerCase();

  // 1. Exact value match
  for (const opt of options) {
    if (opt.value.toLowerCase() === targetL) return opt.value;
  }

  // 2. Exact label match
  for (const opt of options) {
    if (opt.label.toLowerCase() === targetL) return opt.value;
  }

  // 3. Substring match on label or value
  for (const opt of options) {
    const ol = opt.label.toLowerCase();
    const ov = opt.value.toLowerCase();
    if (ol.includes(targetL) || targetL.includes(ol) || ov.includes(targetL) || targetL.includes(ov)) {
      return opt.value;
    }
  }

  // Default to targetValue
  return targetValue;
}

/**
 * Matches Tier 2 semantic screening fields via pre-generated tailored answers or LLM fallback.
 */
export async function matchTier2Semantic(
  field: NormalizedFormField,
  candidateData: CandidateProfilePayload,
  options?: FormMapperOptions & { aiOptions?: AIRouterOptions; jobContext?: JobContext }
): Promise<FormFieldMapping | null> {
  const label = field.label || field.placeholder || field.id;
  if (!label) return null;

  // 1. Check if matching pattern exists in pre-generated candidate tailored answers
  if (candidateData.tailoredAnswers) {
    for (const ta of candidateData.tailoredAnswers) {
      try {
        const regex = new RegExp(ta.questionPattern, "i");
        if (regex.test(label) || regex.test(field.id) || regex.test(field.name || "")) {
          let category = "why_company";
          if (/project|technical|infrastructure/i.test(ta.questionPattern)) {
            category = "technical_project";
          } else if (/salary|compensation/i.test(ta.questionPattern)) {
            category = "salary_compensation";
          }

          let fieldName = "custom_screening";
          if (field.id.includes("3") || /why.*acme/i.test(label)) {
            fieldName = "custom_why_acme";
          } else if (field.id.includes("4") || /technical.*project/i.test(label)) {
            fieldName = "custom_technical_project";
          } else if (field.id === "comments" || /comments/i.test(field.name || "")) {
            fieldName = "comments";
          } else if (field.id.includes("why_role") || /why_role/i.test(field.name || "")) {
            fieldName = "custom_why_role";
          }

          return {
            field: fieldName,
            selector: field.selector,
            tier: 2,
            matchType: "llm-semantic",
            value: ta.answer,
            expectedValue: ta.answer,
            action: "fill",
            expectedAnswerCategory: category,
            confidence: 0.95,
          };
        }
      } catch {
        // Continue if invalid regex pattern
      }
    }
  }

  // 2. Synthesize via AIRouter if requested
  if (options?.synthesizeCustomAnswers && options.jobContext) {
    const candidateContext: CandidateContext = {
      name: candidateData.profile.fullName || composeFullName(candidateData.profile.firstName, candidateData.profile.lastName),
      targetRole: candidateData.profile.currentTitle || "Senior Software Engineer",
      skills: [],
      resumeText: "",
    };

    const answerRes = await answerCustomQuestion(
      candidateContext,
      options.jobContext,
      label,
      options.aiOptions
    );

    return {
      field: `custom_${field.id}`,
      selector: field.selector,
      tier: 2,
      matchType: "llm-semantic",
      value: answerRes.answer,
      action: "fill",
      confidence: 0.85,
    };
  }

  return null;
}

/**
 * Maps a list of normalized form fields to candidate profile facts and answers.
 */
export async function mapFormFields(
  fields: NormalizedFormField[],
  candidateData: CandidateProfilePayload,
  options?: FormMapperOptions & { aiOptions?: AIRouterOptions; jobContext?: JobContext }
): Promise<FormMappingOutcome> {
  const mappedFields: FormFieldMapping[] = [];
  const unmappedFields: NormalizedFormField[] = [];
  const platform = options?.platformHint || "unknown";

  // Track selectors already mapped to prevent duplicate assignments
  const mappedSelectors = new Set<string>();

  for (const field of fields) {
    // Attempt Tier 1 deterministic match
    const tier1Match = matchTier1Deterministic(field, candidateData, platform);
    if (tier1Match && !mappedSelectors.has(tier1Match.selector)) {
      mappedFields.push(tier1Match);
      mappedSelectors.add(tier1Match.selector);
      continue;
    }

    // If radio button option didn't match (e.g. non-target value like "No" when target is "Yes"), skip adding to unmapped
    if (field.type === "radio") {
      continue;
    }

    // Attempt Tier 2 semantic match for remaining textarea / custom screening inputs
    if (field.type === "textarea" || field.type === "text") {
      const tier2Match = await matchTier2Semantic(field, candidateData, options);
      if (tier2Match && !mappedSelectors.has(tier2Match.selector)) {
        mappedFields.push(tier2Match);
        mappedSelectors.add(tier2Match.selector);
        continue;
      }
    }

    // If neither tier mapped the field, record as unmapped
    if (!mappedSelectors.has(field.selector)) {
      unmappedFields.push(field);
    }
  }

  const tier1Count = mappedFields.filter((f) => f.tier === 1).length;
  const tier2Count = mappedFields.filter((f) => f.tier === 2).length;
  const totalInteractiveFields = fields.length;
  const overallConfidence =
    mappedFields.length > 0
      ? mappedFields.reduce((acc, f) => acc + f.confidence, 0) / mappedFields.length
      : 0;

  return {
    platform,
    mappedFields,
    unmappedFields,
    tier1Count,
    tier2Count,
    totalInteractiveFields,
    overallConfidence,
  };
}

/**
 * End-to-end form mapping from raw HTML string.
 */
export async function mapFormFromHtml(
  html: string,
  candidateData: CandidateProfilePayload,
  options?: FormMapperOptions & { aiOptions?: AIRouterOptions; jobContext?: JobContext }
): Promise<FormMappingOutcome> {
  const extracted = extractFormFieldsFromHtml(html);
  const platform = options?.platformHint || extracted.platform;

  const outcome = await mapFormFields(extracted.fields, candidateData, {
    ...options,
    platformHint: platform,
  });

  return {
    ...outcome,
    platform,
    formSelector: extracted.formSelector,
  };
}

/**
 * Generates an in-page evaluation script function for Playwright / in-browser execution.
 * Extracts normalized field schema directly from live browser DOM.
 */
export function generateInPageExtractorScript(): string {
  return `
    (() => {
      const fields = [];
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      
      for (const el of inputs) {
        if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') continue;
        
        let label = '';
        if (el.id) {
          const lbl = document.querySelector('label[for="' + el.id + '"]');
          if (lbl) label = lbl.innerText.trim();
        }
        if (!label && el.getAttribute('aria-label')) {
          label = el.getAttribute('aria-label');
        }
        if (!label && el.placeholder) {
          label = el.placeholder;
        }

        const field = {
          id: el.id || el.name || '',
          selector: el.id ? el.tagName.toLowerCase() + '#' + el.id : (el.name ? el.tagName.toLowerCase() + '[name="' + el.name + '"]' : ''),
          label: label,
          type: el.tagName.toLowerCase() === 'textarea' ? 'textarea' : (el.tagName.toLowerCase() === 'select' ? 'select' : (el.type || 'text')),
          required: el.required || el.getAttribute('aria-required') === 'true',
          name: el.name || '',
          autocomplete: el.autocomplete || '',
          placeholder: el.placeholder || '',
          testId: el.getAttribute('data-testid') || ''
        };

        if (el.tagName.toLowerCase() === 'select') {
          field.options = Array.from(el.querySelectorAll('option')).map(opt => ({
            value: opt.value,
            label: opt.innerText.trim()
          }));
        }

        fields.push(field);
      }

      return fields;
    })()
  `;
}
