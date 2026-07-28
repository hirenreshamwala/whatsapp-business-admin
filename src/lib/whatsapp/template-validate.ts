import { type TemplateBuilder, variableNumbers } from "@/lib/whatsapp/template-types";

export type FieldError = { field: string; message: string };

/**
 * Validate a template builder against Meta's rules. Returns a list of errors
 * (empty = valid). Shared by the wizard (live feedback) and the API (gate before
 * submit) so what the user sees matches what the server enforces.
 */
export function validateTemplate(b: TemplateBuilder): FieldError[] {
  const errors: FieldError[] = [];

  // Name
  if (!b.name.trim()) {
    errors.push({ field: "name", message: "Give the template a name." });
  } else if (!/^[a-z0-9_]+$/.test(b.name)) {
    errors.push({ field: "name", message: "Name may only contain lowercase letters, numbers and underscores." });
  } else if (b.name.length > 512) {
    errors.push({ field: "name", message: "Name is too long (max 512)." });
  }

  if (!b.language) errors.push({ field: "language", message: "Pick a language." });

  // Header
  if (b.header.type === "TEXT") {
    const text = b.header.text ?? "";
    if (!text.trim()) {
      errors.push({ field: "header", message: "Header text is empty." });
    } else if (text.length > 60) {
      errors.push({ field: "header", message: "Header text is too long (max 60)." });
    }
    const vars = variableNumbers(text);
    if (vars.length > 1) {
      errors.push({ field: "header", message: "Header text supports at most one variable." });
    }
    if (vars.length === 1 && !(b.header.textExample ?? "").trim()) {
      errors.push({ field: "header", message: "Provide a sample value for the header variable." });
    }
  }
  if (["IMAGE", "VIDEO", "DOCUMENT"].includes(b.header.type) && !b.header.mediaHandle) {
    errors.push({ field: "header", message: "Upload a sample file for the media header." });
  }

  // Body (required)
  const bodyText = b.body.text ?? "";
  if (!bodyText.trim()) {
    errors.push({ field: "body", message: "Message body is required." });
  } else if (bodyText.length > 1024) {
    errors.push({ field: "body", message: "Body is too long (max 1024)." });
  }
  const bodyVars = variableNumbers(bodyText);
  // Variables must be sequential 1..n
  for (let i = 0; i < bodyVars.length; i++) {
    if (bodyVars[i] !== i + 1) {
      errors.push({ field: "body", message: `Variables must be numbered sequentially starting at 1 (found {{${bodyVars[i]}}}).` });
      break;
    }
  }
  for (let i = 0; i < bodyVars.length; i++) {
    if (!(b.body.examples[i] ?? "").trim()) {
      errors.push({ field: "body", message: `Provide a sample value for {{${i + 1}}}.` });
      break;
    }
  }

  // Footer
  if (b.footer.text && b.footer.text.length > 60) {
    errors.push({ field: "footer", message: "Footer is too long (max 60)." });
  }

  // Buttons
  if (b.buttons.length > 10) {
    errors.push({ field: "buttons", message: "At most 10 buttons." });
  }
  const count = (t: string) => b.buttons.filter((x) => x.type === t).length;
  if (count("PHONE_NUMBER") > 1) errors.push({ field: "buttons", message: "Only one phone-number button." });
  if (count("URL") > 2) errors.push({ field: "buttons", message: "At most two URL buttons." });
  if (count("COPY_CODE") > 1) errors.push({ field: "buttons", message: "Only one copy-code button." });

  b.buttons.forEach((btn, i) => {
    if (btn.type === "QUICK_REPLY" && !btn.text.trim())
      errors.push({ field: `button-${i}`, message: "Quick-reply button needs text." });
    if (btn.type === "URL") {
      if (!btn.text.trim()) errors.push({ field: `button-${i}`, message: "URL button needs text." });
      if (!btn.url.trim()) errors.push({ field: `button-${i}`, message: "URL button needs a URL." });
      if (variableNumbers(btn.url).length > 0 && !(btn.example ?? "").trim())
        errors.push({ field: `button-${i}`, message: "Dynamic URL needs a sample value." });
    }
    if (btn.type === "PHONE_NUMBER") {
      if (!btn.text.trim()) errors.push({ field: `button-${i}`, message: "Call button needs text." });
      if (!btn.phoneNumber.trim()) errors.push({ field: `button-${i}`, message: "Call button needs a phone number." });
    }
    if (btn.type === "COPY_CODE" && !btn.example.trim())
      errors.push({ field: `button-${i}`, message: "Copy-code button needs a sample code." });
  });

  return errors;
}
