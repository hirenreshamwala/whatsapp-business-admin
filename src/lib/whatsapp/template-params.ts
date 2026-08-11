/**
 * Assemble a WhatsApp template `components` array (send-time parameters) from
 * friendly shorthand fields, so API callers don't have to hand-write Meta's
 * nested structure. A raw `components` array can still be passed to override.
 */

export type HeaderMediaInput = {
  type: "image" | "video" | "document";
  link?: string;
  id?: string;
  filename?: string;
};

export type TemplateButtonInput = {
  /** Button type: "url" (default), "quick_reply", or "copy_code". */
  type?: "url" | "quick_reply" | "copy_code";
  /** Position of the button in the template (0-based). */
  index?: number;
  /** The dynamic value: URL suffix, quick-reply payload, or coupon code. */
  value: string;
};

export type TemplateSendInput = {
  /**
   * Body variable values. For positional templates ({{1}}, {{2}}…), pass an
   * ordered array. For named templates ({{code}}, {{first_name}}…), pass an
   * object keyed by variable name. `variables` is an accepted alias.
   */
  body_variables?: (string | number)[] | Record<string, string | number>;
  variables?: (string | number)[] | Record<string, string | number>;
  /** Value for a single {{1}} in a TEXT header. */
  header_text?: string;
  /** Media for an IMAGE/VIDEO/DOCUMENT header. */
  header_media?: HeaderMediaInput;
  /** Dynamic button parameters. */
  buttons?: TemplateButtonInput[];
  /** Full Meta components array — bypasses all shorthands when present. */
  components?: unknown[];
};

export function buildTemplateComponents(input: TemplateSendInput): unknown[] {
  if (input.components && input.components.length) return input.components;

  const components: unknown[] = [];

  // Header — text
  if (input.header_text) {
    components.push({ type: "header", parameters: [{ type: "text", text: String(input.header_text) }] });
  }

  // Header — media (image / video / document)
  if (input.header_media) {
    const m = input.header_media;
    const mediaObj: Record<string, string> = m.link ? { link: m.link } : { id: m.id ?? "" };
    if (m.type === "document" && m.filename) mediaObj.filename = m.filename;
    components.push({ type: "header", parameters: [{ type: m.type, [m.type]: mediaObj }] });
  }

  // Body variables — positional array or named object
  const bodyVars = input.body_variables ?? input.variables;
  if (Array.isArray(bodyVars) && bodyVars.length) {
    components.push({
      type: "body",
      parameters: bodyVars.map((v) => ({ type: "text", text: String(v) })),
    });
  } else if (bodyVars && typeof bodyVars === "object" && Object.keys(bodyVars).length) {
    components.push({
      type: "body",
      parameters: Object.entries(bodyVars).map(([name, v]) => ({ type: "text", parameter_name: name, text: String(v) })),
    });
  }

  // Buttons (dynamic URL / quick-reply payload / copy code)
  for (const b of input.buttons ?? []) {
    const type = (b.type ?? "url").toLowerCase();
    const index = String(b.index ?? 0);
    if (type === "quick_reply") {
      components.push({ type: "button", sub_type: "quick_reply", index, parameters: [{ type: "payload", payload: String(b.value) }] });
    } else if (type === "copy_code") {
      components.push({ type: "button", sub_type: "copy_code", index, parameters: [{ type: "coupon_code", coupon_code: String(b.value) }] });
    } else {
      components.push({ type: "button", sub_type: "url", index, parameters: [{ type: "text", text: String(b.value) }] });
    }
  }

  return components;
}
