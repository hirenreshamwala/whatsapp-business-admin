import { describe, it, expect } from "vitest";
import {
  builderToComponents,
  componentsToBuilder,
  componentsForTemplateSubmission,
  variableNumbers,
  templateParameterFormat,
  type TemplateBuilder,
  type ApiComponent,
} from "@/lib/whatsapp/template-types";
import { templateExampleComponents, templateRuntimeComponents } from "@/lib/whatsapp/template-service";

describe("variableNumbers", () => {
  it("extracts sorted unique variable numbers", () => {
    expect(variableNumbers("Hi {{1}}, order {{2}} and again {{1}}")).toEqual([1, 2]);
  });
  it("returns empty for no variables", () => {
    expect(variableNumbers("no vars here")).toEqual([]);
  });
});

describe("builderToComponents", () => {
  it("uses Meta's preset component schema for authentication copy-code templates", () => {
    const b: TemplateBuilder = {
      name: "otp_verification",
      language: "en_US",
      category: "AUTHENTICATION",
      header: { type: "NONE" },
      body: {
        text: "{{code}} is your verification code.\nFor your security, do not share this code.",
        examples: { code: "123456" },
      },
      footer: {},
      buttons: [{ type: "COPY_CODE", example: "123456" }],
    };

    expect(componentsForTemplateSubmission(b.category, builderToComponents(b))).toEqual([
      { type: "BODY", add_security_recommendation: true },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] },
    ]);
  });

  it("builds body with positional example parameters", () => {
    const b: TemplateBuilder = {
      name: "t",
      language: "en_US",
      category: "MARKETING",
      header: { type: "NONE" },
      body: { text: "Hi {{1}}", examples: { "1": "Priya" } },
      footer: {},
      buttons: [],
    };
    const comps = builderToComponents(b);
    const body = comps.find((c) => c.type === "BODY") as Extract<ApiComponent, { type: "BODY" }>;
    expect(body.text).toBe("Hi {{1}}");
    expect(body.example && "body_text" in body.example ? body.example.body_text : undefined).toEqual([["Priya"]]);
  });

  it("builds body with named example parameters", () => {
    const b: TemplateBuilder = {
      name: "t",
      language: "en_US",
      category: "MARKETING",
      header: { type: "NONE" },
      body: { text: "{{code}} is your code", examples: { code: "1234" } },
      footer: {},
      buttons: [],
    };
    const comps = builderToComponents(b);
    const body = comps.find((c) => c.type === "BODY") as Extract<ApiComponent, { type: "BODY" }>;
    expect(body.example && "body_text_named_params" in body.example ? body.example.body_text_named_params : undefined).toEqual([
      { param_name: "code", example: "1234" },
    ]);
    expect(templateParameterFormat(comps)).toBe("NAMED");
  });

  it("round-trips through componentsToBuilder (positional)", () => {
    const original: TemplateBuilder = {
      name: "welcome",
      language: "en_US",
      category: "UTILITY",
      header: { type: "TEXT", text: "Hi {{1}}", textExample: "Sam" },
      body: { text: "Your code is {{1}}", examples: { "1": "1234" } },
      footer: { text: "Thanks" },
      buttons: [
        { type: "QUICK_REPLY", text: "Yes" },
        { type: "URL", text: "Open", url: "https://x.com/{{1}}", example: "https://x.com/1" },
        { type: "PHONE_NUMBER", text: "Call", phoneNumber: "+15551234567" },
        { type: "COPY_CODE", example: "SAVE20" },
      ],
    };
    const components = builderToComponents(original);
    expect(templateParameterFormat(components)).toBe("POSITIONAL");
    const rebuilt = componentsToBuilder(components, {
      name: original.name,
      language: original.language,
      category: original.category,
    });
    expect(rebuilt.header).toEqual(original.header);
    expect(rebuilt.body).toEqual(original.body);
    expect(rebuilt.footer).toEqual(original.footer);
    expect(rebuilt.buttons).toEqual(original.buttons);
  });

  it("round-trips a named body through componentsToBuilder", () => {
    const original: TemplateBuilder = {
      name: "otp",
      language: "en_US",
      category: "UTILITY",
      header: { type: "NONE" },
      body: { text: "{{code}} is your verification code", examples: { code: "123456" } },
      footer: {},
      buttons: [],
    };
    const components = builderToComponents(original);
    const rebuilt = componentsToBuilder(components, {
      name: original.name,
      language: original.language,
      category: original.category,
    });
    expect(rebuilt.body).toEqual(original.body);
  });

  it("returns undefined parameter format for a template with no variables", () => {
    const b: TemplateBuilder = {
      name: "t",
      language: "en_US",
      category: "MARKETING",
      header: { type: "NONE" },
      body: { text: "No variables here", examples: {} },
      footer: {},
      buttons: [],
    };
    expect(templateParameterFormat(builderToComponents(b))).toBeUndefined();
  });
});

describe("templateExampleComponents", () => {
  it("repeats an authentication OTP for the preset body and copy-code URL button", () => {
    const b: TemplateBuilder = {
      name: "otp_verification",
      language: "en_US",
      category: "AUTHENTICATION",
      header: { type: "NONE" },
      body: { text: "{{code}} is your verification code", examples: { code: "123456" } },
      footer: {},
      buttons: [{ type: "COPY_CODE", example: "123456" }],
    };

    expect(templateExampleComponents(builderToComponents(b), b.category)).toEqual([
      { type: "body", parameters: [{ type: "text", text: "123456" }] },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: "123456" }],
      },
    ]);
  });

  it("emits parameter_name for named body variables", () => {
    const b: TemplateBuilder = {
      name: "t",
      language: "en_US",
      category: "MARKETING",
      header: { type: "NONE" },
      body: { text: "{{code}} is your code", examples: { code: "1234" } },
      footer: {},
      buttons: [],
    };
    const out = templateExampleComponents(builderToComponents(b)) as {
      type: string;
      parameters: { type: string; parameter_name?: string; text: string }[];
    }[];
    expect(out).toEqual([
      { type: "body", parameters: [{ type: "text", parameter_name: "code", text: "1234" }] },
    ]);
  });

  it("emits a plain ordered array for positional body variables", () => {
    const b: TemplateBuilder = {
      name: "t",
      language: "en_US",
      category: "MARKETING",
      header: { type: "NONE" },
      body: { text: "Hi {{1}}", examples: { "1": "Priya" } },
      footer: {},
      buttons: [],
    };
    const out = templateExampleComponents(builderToComponents(b));
    expect(out).toEqual([{ type: "body", parameters: [{ type: "text", text: "Priya" }] }]);
  });
});

describe("templateRuntimeComponents", () => {
  it("uses the entered OTP for both authentication parameters", () => {
    const b: TemplateBuilder = {
      name: "otp_verification",
      language: "en_US",
      category: "AUTHENTICATION",
      header: { type: "NONE" },
      body: { text: "{{code}} is your verification code", examples: { code: "review-only" } },
      footer: {},
      buttons: [{ type: "COPY_CODE", example: "review-only" }],
    };

    expect(templateRuntimeComponents(builderToComponents(b), b.category, { code: "654321" })).toEqual([
      { type: "body", parameters: [{ type: "text", text: "654321" }] },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: "654321" }],
      },
    ]);
  });
});
