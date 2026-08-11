/**
 * Two representations of a template:
 *  - `TemplateBuilder`: the friendly, flat model the wizard edits.
 *  - Graph API `components`: what Meta's message_templates endpoint expects and
 *    what we persist in Template.components.
 */

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
export type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | "FLOW";

export type BuilderButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string }
  | { type: "PHONE_NUMBER"; text: string; phoneNumber: string }
  | { type: "COPY_CODE"; example: string }
  | { type: "FLOW"; text: string; flowId: string; navigateScreen?: string; flowAction: "navigate" | "data_exchange" };

export type TemplateBuilder = {
  name: string;
  language: string;
  category: TemplateCategory;
  header: {
    type: HeaderType;
    text?: string;
    textExample?: string;
    mediaHandle?: string;
    mediaFilename?: string;
  };
  body: {
    text: string;
    /** Sample values keyed by variable token ("1", "2", or a name like "code"). */
    examples: Record<string, string>;
  };
  footer: { text?: string };
  buttons: BuilderButton[];
};

export function emptyBuilder(): TemplateBuilder {
  return {
    name: "",
    language: "en_US",
    category: "MARKETING",
    header: { type: "NONE" },
    body: { text: "", examples: {} },
    footer: {},
    buttons: [],
  };
}

/** Count the highest positional variable ({{1}}..{{n}}) referenced in text. */
export function variableNumbers(text: string): number[] {
  const nums = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

/** Extract unique {{token}} variables (positional or named) in first-seen order. */
export function extractVariables(text: string): string[] {
  const seen = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) seen.add(m[1]);
  return [...seen];
}

/** A variable token is "named" unless it's purely numeric (positional). */
export function isNamedToken(token: string): boolean {
  return !/^\d+$/.test(token);
}

// ---- Graph API component shapes ----

export type NamedParamExample = { param_name: string; example: string };

export type ApiComponent =
  | {
      type: "HEADER";
      format: "TEXT";
      text: string;
      example?: { header_text: string[] } | { header_text_named_params: NamedParamExample[] };
    }
  | {
      type: "HEADER";
      format: "IMAGE" | "VIDEO" | "DOCUMENT";
      example: { header_handle: string[] };
    }
  | {
      type: "BODY";
      text: string;
      example?: { body_text: string[][] } | { body_text_named_params: NamedParamExample[] };
    }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: ApiButton[] };

export type ApiButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "COPY_CODE"; example: string }
  | { type: "FLOW"; text: string; flow_id: string; navigate_screen?: string; flow_action: "navigate" | "data_exchange" };

/** Convert the friendly builder model into the Graph API components array. */
export function builderToComponents(b: TemplateBuilder): ApiComponent[] {
  const components: ApiComponent[] = [];

  const headerTokens = b.header.type === "TEXT" ? extractVariables(b.header.text ?? "") : [];
  const bodyTokens = extractVariables(b.body.text);
  const named = [...headerTokens, ...bodyTokens].some(isNamedToken);

  // HEADER
  if (b.header.type === "TEXT" && b.header.text) {
    const header: ApiComponent = { type: "HEADER", format: "TEXT", text: b.header.text };
    if (headerTokens.length > 0 && b.header.textExample) {
      header.example = named
        ? { header_text_named_params: [{ param_name: headerTokens[0], example: b.header.textExample }] }
        : { header_text: [b.header.textExample] };
    }
    components.push(header);
  } else if (b.header.type === "IMAGE" || b.header.type === "VIDEO" || b.header.type === "DOCUMENT") {
    components.push({
      type: "HEADER",
      format: b.header.type,
      example: { header_handle: b.header.mediaHandle ? [b.header.mediaHandle] : [] },
    });
  }

  // BODY (required)
  const body: ApiComponent = { type: "BODY", text: b.body.text };
  if (bodyTokens.length > 0) {
    body.example = named
      ? { body_text_named_params: bodyTokens.map((token) => ({ param_name: token, example: b.body.examples[token] ?? "" })) }
      : { body_text: [bodyTokens.map((token) => b.body.examples[token] ?? "")] };
  }
  components.push(body);

  // FOOTER
  if (b.footer.text && b.footer.text.trim()) {
    components.push({ type: "FOOTER", text: b.footer.text.trim() });
  }

  // BUTTONS
  if (b.buttons.length > 0) {
    const buttons: ApiButton[] = b.buttons.map((btn) => {
      switch (btn.type) {
        case "QUICK_REPLY":
          return { type: "QUICK_REPLY", text: btn.text };
        case "URL": {
          const isDynamic = variableNumbers(btn.url).length > 0;
          return {
            type: "URL",
            text: btn.text,
            url: btn.url,
            ...(isDynamic && btn.example ? { example: [btn.example] } : {}),
          };
        }
        case "PHONE_NUMBER":
          return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phoneNumber };
        case "COPY_CODE":
          return { type: "COPY_CODE", example: btn.example };
        case "FLOW":
          return { type: "FLOW", text: btn.text, flow_id: btn.flowId, ...(btn.navigateScreen ? { navigate_screen: btn.navigateScreen } : {}), flow_action: btn.flowAction };
      }
    });
    components.push({ type: "BUTTONS", buttons });
  }

  return components;
}

/** Reconstruct a builder from stored Graph API components (for editing/preview). */
export function componentsToBuilder(
  components: ApiComponent[],
  meta: { name: string; language: string; category: TemplateCategory },
): TemplateBuilder {
  const b = emptyBuilder();
  b.name = meta.name;
  b.language = meta.language;
  b.category = meta.category;

  for (const c of components) {
    if (c.type === "HEADER") {
      if (c.format === "TEXT") {
        const example = c.example;
        const textExample =
          example && "header_text_named_params" in example
            ? example.header_text_named_params[0]?.example
            : example?.header_text?.[0];
        b.header = { type: "TEXT", text: c.text, textExample };
      } else {
        b.header = {
          type: c.format,
          mediaHandle: c.example?.header_handle?.[0],
        };
      }
    } else if (c.type === "BODY") {
      const example = c.example;
      const examples: Record<string, string> =
        example && "body_text_named_params" in example
          ? Object.fromEntries(example.body_text_named_params.map((p) => [p.param_name, p.example]))
          : Object.fromEntries((example?.body_text?.[0] ?? []).map((v, i) => [String(i + 1), v]));
      b.body = { text: c.text, examples };
    } else if (c.type === "FOOTER") {
      b.footer = { text: c.text };
    } else if (c.type === "BUTTONS") {
      b.buttons = c.buttons.map((btn): BuilderButton => {
        switch (btn.type) {
          case "QUICK_REPLY":
            return { type: "QUICK_REPLY", text: btn.text };
          case "URL":
            return { type: "URL", text: btn.text, url: btn.url, example: btn.example?.[0] };
          case "PHONE_NUMBER":
            return { type: "PHONE_NUMBER", text: btn.text, phoneNumber: btn.phone_number };
          case "COPY_CODE":
            return { type: "COPY_CODE", example: btn.example };
          case "FLOW":
            return { type: "FLOW", text: btn.text, flowId: btn.flow_id, navigateScreen: btn.navigate_screen, flowAction: btn.flow_action };
        }
      });
    }
  }
  return b;
}

/**
 * Whether a set of Graph API components uses NAMED or POSITIONAL variables,
 * derived from the example shape actually stored (rather than a separate flag).
 * Returns undefined when the template has no variables at all.
 */
export function templateParameterFormat(components: ApiComponent[]): "NAMED" | "POSITIONAL" | undefined {
  for (const c of components) {
    if (c.type === "BODY" && c.example) {
      return "body_text_named_params" in c.example ? "NAMED" : "POSITIONAL";
    }
    if (c.type === "HEADER" && c.format === "TEXT" && c.example) {
      return "header_text_named_params" in c.example ? "NAMED" : "POSITIONAL";
    }
  }
  return undefined;
}

/**
 * Convert stored editor components to the category-specific shape accepted by
 * Meta's template-creation endpoint.
 *
 * Authentication copy-code templates use preset, non-editable text. Their
 * BODY therefore takes flags rather than `text`/`example`, and their button is
 * an OTP button rather than the COPY_CODE button used by regular templates.
 */
export function componentsForTemplateSubmission(
  category: TemplateCategory,
  components: ApiComponent[],
): unknown[] {
  if (category !== "AUTHENTICATION") return components;

  const submission: unknown[] = [
    { type: "BODY", add_security_recommendation: true },
  ];

  const copyCodeButton = components
    .find((component) => component.type === "BUTTONS")
    ?.buttons.find((button) => button.type === "COPY_CODE");

  if (copyCodeButton) {
    submission.push({
      type: "BUTTONS",
      buttons: [{ type: "OTP", otp_type: "COPY_CODE" }],
    });
  }

  return submission;
}
