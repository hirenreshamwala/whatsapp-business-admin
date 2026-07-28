import { describe, it, expect, beforeAll } from "vitest";
import { renderTemplateText, substituteVariables } from "@/lib/whatsapp/format";

describe("substituteVariables", () => {
  it("substitutes provided sample values", () => {
    expect(substituteVariables("Hi {{1}} and {{2}}", ["A", "B"])).toBe("Hi A and B");
  });
  it("marks missing values with a placeholder", () => {
    expect(substituteVariables("Hi {{1}}", [])).toContain("VAR1");
  });
  it("does not emit raw NUL bytes for missing values", () => {
    expect(substituteVariables("Hi {{1}}", [])).not.toContain(String.fromCharCode(0));
  });
});

describe("renderTemplateText", () => {
  it("renders bold/italic/strike with trailing punctuation", () => {
    const html = renderTemplateText("Hi *{{1}}*, total _{{2}}_. ~old~", ["Priya", "₹99"]);
    expect(html).toContain("<strong>Priya</strong>");
    expect(html).toContain("<em>₹99</em>");
    expect(html).toContain("<del>old</del>");
  });
  it("escapes HTML", () => {
    expect(renderTemplateText("<script>", [])).toContain("&lt;script&gt;");
  });
  it("renders a missing variable as a highlighted placeholder", () => {
    const html = renderTemplateText("Hi {{1}}", []);
    expect(html).toContain('class="rounded bg-amber-200/70 px-1 text-amber-900"');
    expect(html).toContain(">{{1}}</span>");
  });
});

describe("crypto round-trip", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "0".repeat(64);
  });
  it("encrypts and decrypts back to the original", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const secret = "EAAB_super_secret_token";
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });
});
