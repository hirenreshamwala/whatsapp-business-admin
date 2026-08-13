import { type TemplateBuilder, variableNumbers, extractVariables, isNamedToken } from "@/lib/whatsapp/template-types";

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
    const headerTokens = extractVariables(text);
    if (headerTokens.length > 1) {
      errors.push({ field: "header", message: "Header text supports at most one variable." });
    }
    if (headerTokens.length === 1 && !(b.header.textExample ?? "").trim()) {
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

  // Variables: a template is either fully positional ({{1}}, {{2}}…) or fully
  // named ({{code}}, {{first_name}}…) — Meta doesn't allow mixing the two.
  const headerTokens = b.header.type === "TEXT" ? extractVariables(b.header.text ?? "") : [];
  const bodyTokens = extractVariables(bodyText);
  const allTokens = [...headerTokens, ...bodyTokens];
  const hasNamed = allTokens.some(isNamedToken);
  const hasPositional = allTokens.some((t) => !isNamedToken(t));

  if (hasNamed && hasPositional) {
    errors.push({ field: "body", message: "Can't mix numbered variables like {{1}} and named variables like {{code}} in the same template." });
  } else if (hasNamed) {
    for (const token of bodyTokens) {
      if (!/^[a-z][a-z_]*$/.test(token)) {
        errors.push({ field: "body", message: "Variable names must be lowercase letters and underscores only (e.g. {{customer_name}})." });
        break;
      }
    }
  } else {
    // Positional: must be sequential 1..n
    const bodyVars = variableNumbers(bodyText);
    for (let i = 0; i < bodyVars.length; i++) {
      if (bodyVars[i] !== i + 1) {
        errors.push({ field: "body", message: `Variables must be numbered sequentially starting at 1 (found {{${bodyVars[i]}}}).` });
        break;
      }
    }
  }
  for (const token of bodyTokens) {
    if (!(b.body.examples[token] ?? "").trim()) {
      errors.push({ field: "body", message: `Provide a sample value for {{${token}}}.` });
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
  if (count("FLOW") > 1) errors.push({ field: "buttons", message: "Only one Flow button." });

  b.buttons.forEach((btn, i) => {
    if (btn.type === "QUICK_REPLY" && !btn.text.trim())
      errors.push({ field: `button-${i}`, message: "Quick-reply button needs text." });
    if (btn.type === "URL") {
      if (!btn.text.trim()) errors.push({ field: `button-${i}`, message: "URL button needs text." });
      if (!btn.url.trim()) errors.push({ field: `button-${i}`, message: "URL button needs a URL." });
      const variables = variableNumbers(btn.url);
      if (variables.length > 0) {
        if (variables.length !== 1 || variables[0] !== 1 || !/\{\{\s*1\s*\}\}\s*$/.test(btn.url))
          errors.push({ field: `button-${i}`, message: "Dynamic URL must contain one {{1}} at the end." });
        const fixedPrefix = btn.url.replace(/\{\{\s*1\s*\}\}\s*$/, "");
        let validFixedPrefix = false;
        try {
          const parsed = new URL(fixedPrefix);
          validFixedPrefix = ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
        } catch {
          validFixedPrefix = false;
        }
        if (!validFixedPrefix)
          errors.push({ field: `button-${i}`, message: "Dynamic URL needs a fixed http(s) prefix before {{1}}." });
        if (!(btn.example ?? "").trim())
          errors.push({ field: `button-${i}`, message: "Dynamic URL needs a sample replacement value." });
      }
    }
    if (btn.type === "PHONE_NUMBER") {
      if (!btn.text.trim()) errors.push({ field: `button-${i}`, message: "Call button needs text." });
      if (!btn.phoneNumber.trim()) errors.push({ field: `button-${i}`, message: "Call button needs a phone number." });
    }
    if (btn.type === "COPY_CODE" && !btn.example.trim())
      errors.push({ field: `button-${i}`, message: "Copy-code button needs a sample code." });
    if (btn.type === "FLOW") {
      if (!btn.text.trim()) errors.push({ field: `button-${i}`, message: "Flow button needs text." });
      if (!btn.flowId) errors.push({ field: `button-${i}`, message: "Flow button needs a published Flow." });
      if (btn.flowAction === "navigate" && !btn.navigateScreen) errors.push({ field: `button-${i}`, message: "Navigate Flow buttons need an entry screen." });
    }
  });

  return errors;
}
