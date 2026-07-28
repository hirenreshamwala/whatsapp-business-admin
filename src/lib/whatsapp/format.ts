/**
 * Render WhatsApp-style markup (*bold*, _italic_, ~strike~, ```mono```) to safe
 * HTML, and substitute {{n}} placeholders with sample values. Client-safe.
 */

const VARIABLE_MARKER_START = "\uE000";
const VARIABLE_MARKER_END = "\uE001";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Replace {{1}}, {{2}} … with example values (1-indexed). Missing → highlighted chip. */
export function substituteVariables(text: string, examples: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => {
    const value = examples[Number(n) - 1];
    if (value && value.trim()) return value;
    return `${VARIABLE_MARKER_START}VAR${n}${VARIABLE_MARKER_END}`;
  });
}

// Build the formatting patterns from strings to keep their parsing consistent
// across the server and Webpack's browser transform.
const RE_CODE = new RegExp("```([\\s\\S]+?)```", "g");
const RE_BOLD = new RegExp("\\*(?!\\s)([^*\\n]*?[^*\\s])\\*", "g");
const RE_ITALIC = new RegExp("(?<![\\w])_(?!\\s)([^_\\n]*?[^_\\s])_(?![\\w])", "g");
const RE_STRIKE = new RegExp("~(?!\\s)([^~\\n]*?[^~\\s])~", "g");
const RE_BOLD1 = new RegExp("\\*([^\\s*])\\*", "g");
const RE_VARIABLE_MARKER = new RegExp(
  `${VARIABLE_MARKER_START}VAR(\\d+)${VARIABLE_MARKER_END}`,
  "g",
);

export function whatsappToHtml(text: string): string {
  let html = escapeHtml(text);

  // Markers wrap non-empty text that doesn't start/end with a space (WhatsApp rule),
  // and may be followed by punctuation (e.g. *Priya*, renders "Priya" bold).
  html = html.replace(RE_CODE, "<code>$1</code>");
  html = html.replace(RE_BOLD, "<strong>$1</strong>");
  html = html.replace(RE_ITALIC, "<em>$1</em>");
  html = html.replace(RE_STRIKE, "<del>$1</del>");
  html = html.replace(RE_BOLD1, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br/>");

  // Style unresolved variable placeholders.
  html = html.replace(
    RE_VARIABLE_MARKER,
    (_m, n) => `<span class="rounded bg-amber-200/70 px-1 text-amber-900">{{${n}}}</span>`,
  );
  return html;
}

/** Full pipeline: substitute samples then format. */
export function renderTemplateText(text: string, examples: string[] = []): string {
  return whatsappToHtml(substituteVariables(text, examples));
}
