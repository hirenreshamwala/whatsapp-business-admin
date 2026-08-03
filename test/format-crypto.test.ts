import { describe, it, expect, beforeAll } from "vitest";
import { renderTemplateText, selectionHasWhatsAppFormat, substituteVariables, toggleWhatsAppFormat } from "@/lib/whatsapp/format";

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

describe("toggleWhatsAppFormat", () => {
  it("wraps selected text and keeps the content selected", () => {
    const result = toggleWhatsAppFormat("Hello world", 6, 11, "bold");
    expect(result).toMatchObject({ text: "Hello *world*", selectionStart: 7, selectionEnd: 12, changed: true, formatted: true });
  });

  it("toggles formatting when selection excludes or includes its markers", () => {
    expect(toggleWhatsAppFormat("Hello *world*", 7, 12, "bold").text).toBe("Hello world");
    expect(toggleWhatsAppFormat("Hello *world*", 6, 13, "bold").text).toBe("Hello world");
  });

  it("preserves nested formatting", () => {
    const result = toggleWhatsAppFormat("_word_", 1, 5, "bold");
    expect(result.text).toBe("_*word*_");
    expect(renderTemplateText(result.text)).toBe("<em><strong>word</strong></em>");
  });

  it("formats only unformatted portions of a mixed multiline selection", () => {
    const text = "*first*\nsecond";
    const result = toggleWhatsAppFormat(text, 0, text.length, "bold");
    expect(result.text).toBe("*first*\n*second*");
  });

  it("keeps outer whitespace outside markers and formats each selected line", () => {
    const text = "  first  \n second ";
    const result = toggleWhatsAppFormat(text, 0, text.length, "italic");
    expect(result.text).toBe("  _first_  \n _second_ ");
  });

  it("expands a partial variable selection to the complete token", () => {
    const result = toggleWhatsAppFormat("Hi {{1}}!", 5, 6, "bold");
    expect(result.text).toBe("Hi *{{1}}*!");
  });

  it("reports active formatting and ignores an empty selection", () => {
    expect(selectionHasWhatsAppFormat("*word*", 1, 5, "bold")).toBe(true);
    expect(toggleWhatsAppFormat("word", 2, 2, "bold")).toMatchObject({ changed: false, reason: "no-selection" });
  });

  it("refuses formatting that would exceed the maximum length", () => {
    expect(toggleWhatsAppFormat("word", 0, 4, "bold", 4)).toMatchObject({ text: "word", changed: false, reason: "max-length" });
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
