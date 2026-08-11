import { describe, it, expect } from "vitest";
import { emptyBuilder, type TemplateBuilder } from "@/lib/whatsapp/template-types";
import { validateTemplate } from "@/lib/whatsapp/template-validate";

function base(): TemplateBuilder {
  return { ...emptyBuilder(), name: "order_update", body: { text: "Hello", examples: {} } };
}

describe("validateTemplate", () => {
  it("passes a minimal valid template", () => {
    expect(validateTemplate(base())).toEqual([]);
  });

  it("rejects an empty name", () => {
    const b = base();
    b.name = "";
    expect(validateTemplate(b).some((e) => e.field === "name")).toBe(true);
  });

  it("rejects uppercase / invalid name characters", () => {
    const b = base();
    b.name = "Order Update";
    expect(validateTemplate(b).some((e) => e.field === "name")).toBe(true);
  });

  it("requires a non-empty body", () => {
    const b = base();
    b.body.text = "";
    expect(validateTemplate(b).some((e) => e.field === "body")).toBe(true);
  });

  it("requires sample values for body variables", () => {
    const b = base();
    b.body = { text: "Hi {{1}}", examples: {} };
    expect(validateTemplate(b).some((e) => e.field === "body")).toBe(true);
    b.body.examples = { "1": "Priya" };
    expect(validateTemplate(b).some((e) => e.field === "body")).toBe(false);
  });

  it("requires body variables to be sequential from 1", () => {
    const b = base();
    b.body = { text: "Hi {{2}}", examples: { "1": "x", "2": "y" } };
    expect(validateTemplate(b).some((e) => e.field === "body")).toBe(true);
  });

  it("limits header text to one variable", () => {
    const b = base();
    b.header = { type: "TEXT", text: "{{1}} {{2}}", textExample: "a" };
    expect(validateTemplate(b).some((e) => e.field === "header")).toBe(true);
  });

  it("requires a media handle for media headers", () => {
    const b = base();
    b.header = { type: "IMAGE" };
    expect(validateTemplate(b).some((e) => e.field === "header")).toBe(true);
    b.header.mediaHandle = "handle123";
    expect(validateTemplate(b).some((e) => e.field === "header")).toBe(false);
  });

  it("enforces button limits", () => {
    const b = base();
    b.buttons = [
      { type: "PHONE_NUMBER", text: "Call", phoneNumber: "+1" },
      { type: "PHONE_NUMBER", text: "Call2", phoneNumber: "+2" },
    ];
    expect(validateTemplate(b).some((e) => e.field === "buttons")).toBe(true);
  });

  it("requires a sample for a dynamic URL button", () => {
    const b = base();
    b.buttons = [{ type: "URL", text: "Track", url: "https://x.com/{{1}}" }];
    expect(validateTemplate(b).some((e) => e.field.startsWith("button"))).toBe(true);
  });

  it("accepts named variables with sample values", () => {
    const b = base();
    b.body = { text: "{{code}} is your code", examples: { code: "1234" } };
    expect(validateTemplate(b).some((e) => e.field === "body")).toBe(false);
  });

  it("rejects mixing positional and named variables", () => {
    const b = base();
    b.body = { text: "Hi {{1}}, your code is {{code}}", examples: { "1": "Priya", code: "1234" } };
    expect(validateTemplate(b).some((e) => e.field === "body")).toBe(true);
  });

  it("rejects invalid characters in named variables", () => {
    const b = base();
    b.body = { text: "{{MyCode}} is your code", examples: { MyCode: "1234" } };
    expect(validateTemplate(b).some((e) => e.field === "body")).toBe(true);
  });
});
