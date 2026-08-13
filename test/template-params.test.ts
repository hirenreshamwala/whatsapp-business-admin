import { describe, it, expect } from "vitest";
import { buildTemplateComponents, normalizeTemplateButtonInputs } from "@/lib/whatsapp/template-params";
import type { ApiComponent } from "@/lib/whatsapp/template-types";

const buttonTemplate = (...buttons: Extract<ApiComponent, { type: "BUTTONS" }>["buttons"]): ApiComponent[] => [
  { type: "BODY", text: "Welcome" },
  { type: "BUTTONS", buttons },
];

describe("buildTemplateComponents", () => {
  it("returns empty for no input", () => {
    expect(buildTemplateComponents({})).toEqual([]);
  });

  it("builds body parameters from body_variables", () => {
    expect(buildTemplateComponents({ body_variables: ["Priya", 5] })).toEqual([
      { type: "body", parameters: [{ type: "text", text: "Priya" }, { type: "text", text: "5" }] },
    ]);
  });

  it("accepts `variables` as an alias for body_variables", () => {
    expect(buildTemplateComponents({ variables: ["A"] })).toEqual([
      { type: "body", parameters: [{ type: "text", text: "A" }] },
    ]);
  });

  it("builds named body parameters from a body_variables object", () => {
    expect(buildTemplateComponents({ body_variables: { code: "1234", first_name: "Priya" } })).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "code", text: "1234" },
          { type: "text", parameter_name: "first_name", text: "Priya" },
        ],
      },
    ]);
  });

  it("builds a text header parameter", () => {
    expect(buildTemplateComponents({ header_text: "SALE" })[0]).toEqual({
      type: "header",
      parameters: [{ type: "text", text: "SALE" }],
    });
  });

  it("builds a media header by link", () => {
    expect(buildTemplateComponents({ header_media: { type: "image", link: "https://x/y.jpg" } })[0]).toEqual({
      type: "header",
      parameters: [{ type: "image", image: { link: "https://x/y.jpg" } }],
    });
  });

  it("includes filename for a document header", () => {
    const comp = buildTemplateComponents({
      header_media: { type: "document", link: "https://x/f.pdf", filename: "f.pdf" },
    })[0] as { parameters: { document: Record<string, string> }[] };
    expect(comp.parameters[0].document).toEqual({ link: "https://x/f.pdf", filename: "f.pdf" });
  });

  it("builds a dynamic URL button", () => {
    expect(buildTemplateComponents({ buttons: [{ type: "url", index: 0, value: "order/1" }] })[0]).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "order/1" }],
    });
  });

  it("builds a copy_code button with coupon_code", () => {
    expect(buildTemplateComponents({ buttons: [{ type: "copy_code", value: "SAVE20" }] })[0]).toEqual({
      type: "button",
      sub_type: "copy_code",
      index: "0",
      parameters: [{ type: "coupon_code", coupon_code: "SAVE20" }],
    });
  });

  it("orders header, body, then buttons", () => {
    const out = buildTemplateComponents({
      header_text: "H",
      body_variables: ["B"],
      buttons: [{ value: "u" }],
    }) as { type: string }[];
    expect(out.map((c) => c.type)).toEqual(["header", "body", "button"]);
  });

  it("raw components override all shorthands", () => {
    const raw = [{ type: "body", parameters: [] }];
    expect(buildTemplateComponents({ components: raw, header_text: "ignored" })).toBe(raw);
  });
});

describe("normalizeTemplateButtonInputs", () => {
  it("preserves Meta's native replacement value", () => {
    const components = buttonTemplate({ type: "URL", text: "Watch", url: "https://youtu.be/{{1}}", example: ["abc"] });
    expect(normalizeTemplateButtonInputs(components, [{ type: "url", index: 0, value: "LdoqBW-l1IU" }])).toEqual([
      { type: "url", index: 0, value: "LdoqBW-l1IU" },
    ]);
  });

  it("extracts the replacement from a complete matching URL", () => {
    const components = buttonTemplate({ type: "URL", text: "Watch", url: "https://youtu.be/{{1}}", example: ["abc"] });
    expect(normalizeTemplateButtonInputs(components, [{ type: "url", index: 0, value: "https://youtu.be/LdoqBW-l1IU" }])).toEqual([
      { type: "url", index: 0, value: "LdoqBW-l1IU" },
    ]);
  });

  it("normalizes multiple URL buttons by their actual template index", () => {
    const components = buttonTemplate(
      { type: "URL", text: "Instagram", url: "https://www.instagram.com/reel/{{1}}", example: ["abc"] },
      { type: "URL", text: "YouTube", url: "https://youtu.be/{{1}}", example: ["xyz"] },
    );
    expect(normalizeTemplateButtonInputs(components, [
      { type: "url", index: 0, value: "https://www.instagram.com/reel/DbBakl8oS7u/" },
      { type: "url", index: 1, value: "https://youtu.be/LdoqBW-l1IU" },
    ])).toEqual([
      { type: "url", index: 0, value: "DbBakl8oS7u/" },
      { type: "url", index: 1, value: "LdoqBW-l1IU" },
    ]);
  });

  it("rejects a parameter for a static URL button", () => {
    const components = buttonTemplate({ type: "URL", text: "Website", url: "https://example.com" });
    expect(() => normalizeTemplateButtonInputs(components, [{ type: "url", index: 0, value: "https://other.example" }]))
      .toThrow(/static approved URL/);
  });

  it("rejects complete URLs outside the approved pattern", () => {
    const components = buttonTemplate({ type: "URL", text: "Watch", url: "https://youtu.be/{{1}}", example: ["abc"] });
    expect(() => normalizeTemplateButtonInputs(components, [{ type: "url", index: 0, value: "https://example.com/video" }]))
      .toThrow(/must match the approved pattern/);
  });

  it("rejects wrong types, invalid indices, empty values, and duplicate indices", () => {
    const components = buttonTemplate({ type: "URL", text: "Watch", url: "https://youtu.be/{{1}}", example: ["abc"] });
    expect(() => normalizeTemplateButtonInputs(components, [{ type: "quick_reply", index: 0, value: "x" }])).toThrow(/expects type "url"/);
    expect(() => normalizeTemplateButtonInputs(components, [{ type: "url", index: 2, value: "x" }])).toThrow(/does not exist/);
    expect(() => normalizeTemplateButtonInputs(components, [{ type: "url", index: 0, value: " " }])).toThrow(/non-empty/);
    expect(() => normalizeTemplateButtonInputs(components, [
      { type: "url", index: 0, value: "one" },
      { type: "url", index: 0, value: "two" },
    ])).toThrow(/Duplicate/);
  });
});
