import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifySignature } from "@/lib/whatsapp/signature";
import { isWithinSessionWindow, SESSION_WINDOW_MS } from "@/lib/whatsapp/window";

describe("verifySignature", () => {
  const secret = "app_secret_123";
  const body = JSON.stringify({ hello: "world" });
  const good = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a correct signature", () => {
    expect(verifySignature(body, good, secret)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifySignature(body + "x", good, secret)).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(verifySignature(body, good, "other")).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(verifySignature(body, null, secret)).toBe(false);
  });
});

describe("isWithinSessionWindow", () => {
  const now = Date.now();
  it("is false with no inbound message", () => {
    expect(isWithinSessionWindow(null, now)).toBe(false);
  });
  it("is true just inside 24h", () => {
    expect(isWithinSessionWindow(new Date(now - SESSION_WINDOW_MS + 1000), now)).toBe(true);
  });
  it("is false just outside 24h", () => {
    expect(isWithinSessionWindow(new Date(now - SESSION_WINDOW_MS - 1000), now)).toBe(false);
  });
});
