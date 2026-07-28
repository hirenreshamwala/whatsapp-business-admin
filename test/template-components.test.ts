import { describe, it, expect } from "vitest";
import {
  builderToComponents,
  componentsToBuilder,
  variableNumbers,
  type TemplateBuilder,
  type ApiComponent,
} from "@/lib/whatsapp/template-types";

describe("variableNumbers", () => {
  it("extracts sorted unique variable numbers", () => {
    expect(variableNumbers("Hi {{1}}, order {{2}} and again {{1}}")).toEqual([1, 2]);
  });
  it("returns empty for no variables", () => {
    expect(variableNumbers("no vars here")).toEqual([]);
  });
});

describe("builderToComponents", () => {
  it("builds body with example parameters", () => {
    const b: TemplateBuilder = {
      name: "t",
      language: "en_US",
      category: "MARKETING",
      header: { type: "NONE" },
      body: { text: "Hi {{1}}", examples: ["Priya"] },
      footer: {},
      buttons: [],
    };
    const comps = builderToComponents(b);
    const body = comps.find((c) => c.type === "BODY") as Extract<ApiComponent, { type: "BODY" }>;
    expect(body.text).toBe("Hi {{1}}");
    expect(body.example?.body_text).toEqual([["Priya"]]);
  });

  it("round-trips through componentsToBuilder", () => {
    const original: TemplateBuilder = {
      name: "welcome",
      language: "en_US",
      category: "UTILITY",
      header: { type: "TEXT", text: "Hi {{1}}", textExample: "Sam" },
      body: { text: "Your code is {{1}}", examples: ["1234"] },
      footer: { text: "Thanks" },
      buttons: [
        { type: "QUICK_REPLY", text: "Yes" },
        { type: "URL", text: "Open", url: "https://x.com/{{1}}", example: "https://x.com/1" },
        { type: "PHONE_NUMBER", text: "Call", phoneNumber: "+15551234567" },
        { type: "COPY_CODE", example: "SAVE20" },
      ],
    };
    const components = builderToComponents(original);
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
});
