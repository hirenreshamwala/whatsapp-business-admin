import { describe, it, expect } from "vitest";
import { buildTemplateComponents } from "@/lib/whatsapp/template-params";

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
