import { describe, expect, it } from "vitest";
import { ApiError, parseJsonBody } from "@/lib/v1";

describe("parseJsonBody", () => {
  it("parses a valid JSON body", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"to":"919913260460"}',
    });

    await expect(parseJsonBody(request)).resolves.toEqual({ to: "919913260460" });
  });

  it("returns a useful client error for malformed JSON", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"to":"919913260460" "buttons":[]}',
    });

    await expect(parseJsonBody(request)).rejects.toMatchObject<ApiError>({
      status: 400,
      message: "Invalid JSON request body. Check for missing commas, quotes, or brackets.",
    });
  });
});
