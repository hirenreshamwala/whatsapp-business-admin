/**
 * Assemble a WhatsApp template `components` array (send-time parameters) from
 * friendly shorthand fields, so API callers don't have to hand-write Meta's
 * nested structure. A raw `components` array can still be passed to override.
 */

import type { ApiComponent, ApiButton } from "@/lib/whatsapp/template-types";

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

export class TemplateButtonParameterError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "TemplateButtonParameterError";
  }
}

const URL_TOKEN = /\{\{\s*1\s*\}\}/g;

function runtimeButtonType(button: ApiButton): TemplateButtonInput["type"] | null {
  if (button.type === "URL") return "url";
  if (button.type === "QUICK_REPLY") return "quick_reply";
  if (button.type === "COPY_CODE") return "copy_code";
  return null;
}

/**
 * Validate friendly send-time button values against the approved template.
 * For dynamic URL buttons, callers may pass either Meta's native replacement
 * value or the complete URL resolved from the approved `...{{1}}` pattern.
 */
export function normalizeTemplateButtonInputs(
  templateComponents: ApiComponent[],
  inputs?: TemplateButtonInput[],
): TemplateButtonInput[] | undefined {
  if (!inputs?.length) return inputs;

  const component = templateComponents.find((item) => item.type === "BUTTONS");
  const templateButtons = component?.type === "BUTTONS" ? component.buttons : [];
  const seen = new Set<number>();

  return inputs.map((input) => {
    const index = input.index ?? 0;
    if (seen.has(index)) {
      throw new TemplateButtonParameterError(`Duplicate button parameter for index ${index}.`);
    }
    seen.add(index);

    const templateButton = templateButtons[index];
    if (!templateButton) {
      throw new TemplateButtonParameterError(
        `Button index ${index} does not exist in the approved template. Button indices are zero-based.`,
      );
    }

    const suppliedType = input.type ?? "url";
    const expectedType = runtimeButtonType(templateButton);
    if (!expectedType) {
      throw new TemplateButtonParameterError(
        `Button index ${index} is ${templateButton.type.toLowerCase()} and does not accept a send-time parameter.`,
      );
    }
    if (suppliedType !== expectedType) {
      throw new TemplateButtonParameterError(
        `Button index ${index} expects type "${expectedType}", not "${suppliedType}".`,
      );
    }

    const value = input.value.trim();
    if (!value) throw new TemplateButtonParameterError(`Button index ${index} requires a non-empty value.`);
    if (templateButton.type !== "URL") return { ...input, type: suppliedType, index, value };

    const matches = [...templateButton.url.matchAll(URL_TOKEN)];
    if (matches.length === 0) {
      throw new TemplateButtonParameterError(
        `Button index ${index} has a static approved URL and must be omitted from "buttons". It is included automatically.`,
      );
    }
    if (matches.length !== 1) {
      throw new TemplateButtonParameterError(`Button index ${index} has an unsupported dynamic URL pattern.`);
    }

    // Native Meta input is just the replacement. Complete http(s) URLs are a
    // convenience accepted only when their fixed approved prefix/suffix match.
    let normalized = value;
    if (/^https?:\/\//i.test(value)) {
      const match = matches[0];
      const prefix = templateButton.url.slice(0, match.index);
      const suffix = templateButton.url.slice((match.index ?? 0) + match[0].length);
      if (!value.startsWith(prefix) || !value.endsWith(suffix) || value.length <= prefix.length + suffix.length) {
        throw new TemplateButtonParameterError(
          `Button index ${index} URL must match the approved pattern "${templateButton.url}".`,
        );
      }
      normalized = value.slice(prefix.length, suffix ? -suffix.length : undefined);
    }

    if (!normalized) throw new TemplateButtonParameterError(`Button index ${index} requires a non-empty URL value.`);
    return { ...input, type: "url", index, value: normalized };
  });
}

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
