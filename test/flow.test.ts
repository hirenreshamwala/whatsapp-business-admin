import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { emptyFlowJson } from "../src/lib/whatsapp/flow-types";
import { flowUsesEndpoint, validateFlowJson } from "../src/lib/whatsapp/flow-validate";
import { decryptFlowRequestWithPrivateKeys, encryptFlowResponse, flowTokenHash, generateFlowKeyPair } from "../src/lib/whatsapp/flow-crypto";
import { assertSafeConnectorUrl } from "../src/lib/whatsapp/flow-connector";
import { builderToComponents, componentsToBuilder, emptyBuilder } from "../src/lib/whatsapp/template-types";

describe("WhatsApp Flow JSON", () => {
  it("accepts the starter Flow and preserves a complete Flow button", () => {
    expect(validateFlowJson(emptyFlowJson()).filter((issue) => issue.severity === "error")).toEqual([]);
    const builder = emptyBuilder();
    builder.body.text = "Complete the form";
    builder.buttons = [{ type: "FLOW", text: "Open form", flowId: "12345", navigateScreen: "CONTACT", flowAction: "navigate" }];
    const components = builderToComponents(builder);
    expect(components.at(-1)).toMatchObject({ type: "BUTTONS", buttons: [{ type: "FLOW", flow_id: "12345" }] });
    expect(componentsToBuilder(components, { name: "form", language: "en_US", category: "UTILITY" }).buttons[0]).toMatchObject({ type: "FLOW", flowId: "12345" });
  });

  it("requires routing and data API 3.0 for dynamic actions", () => {
    const json = emptyFlowJson();
    const footer = (json.screens[0].layout.children[1] as { children: { type: string; "on-click-action"?: { name: string } }[] }).children.at(-1)!;
    footer["on-click-action"] = { name: "data_exchange" };
    expect(flowUsesEndpoint(json)).toBe(true);
    const messages = validateFlowJson(json).map((issue) => issue.message);
    expect(messages).toContain("Dynamic Flows require data_api_version 3.0.");
    expect(messages).toContain("Dynamic Flows require an explicit routing model.");
  });
});

describe("WhatsApp Flow endpoint crypto", () => {
  it("decrypts Meta-style RSA/AES input and encrypts the flipped-IV response", () => {
    const pair = generateFlowKeyPair();
    const aesKey = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const request = { version: "3.0", action: "INIT", flow_token: "token-1" };
    const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv);
    const encryptedData = Buffer.concat([cipher.update(JSON.stringify(request)), cipher.final(), cipher.getAuthTag()]);
    const encryptedKey = crypto.publicEncrypt({ key: pair.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, aesKey);
    const decrypted = decryptFlowRequestWithPrivateKeys({ encrypted_aes_key: encryptedKey.toString("base64"), encrypted_flow_data: encryptedData.toString("base64"), initial_vector: iv.toString("base64") }, [pair.privateKey]);
    expect(decrypted.body).toEqual(request);

    const response = { screen: "CONTACT", data: { ready: true } };
    const encryptedResponse = Buffer.from(encryptFlowResponse(response, decrypted.aesKey, decrypted.iv), "base64");
    const responseDecipher = crypto.createDecipheriv("aes-128-gcm", aesKey, Buffer.from(iv.map((byte) => ~byte)));
    responseDecipher.setAuthTag(encryptedResponse.subarray(-16));
    const plaintext = Buffer.concat([responseDecipher.update(encryptedResponse.subarray(0, -16)), responseDecipher.final()]).toString("utf8");
    expect(JSON.parse(plaintext)).toEqual(response);
    expect(flowTokenHash("token-1")).toHaveLength(64);
  });
});

describe("Flow connector network policy", () => {
  it("rejects HTTP, unapproved hosts, and loopback targets", async () => {
    await expect(assertSafeConnectorUrl("http://example.com", ["example.com"])).rejects.toThrow("HTTPS");
    await expect(assertSafeConnectorUrl("https://example.com", ["api.example.com"])).rejects.toThrow("not approved");
    await expect(assertSafeConnectorUrl("https://127.0.0.1/flow", ["127.0.0.1"])).rejects.toThrow("blocked network");
  });
});
