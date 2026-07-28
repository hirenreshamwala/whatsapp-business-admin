import { v1Handle, apiOk, requireApiKey } from "@/lib/v1";
import { getWabaConfig } from "@/lib/settings";

/** GET /api/v1/status — connection status of the WhatsApp account. */
export const GET = v1Handle(async (req) => {
  await requireApiKey(req);
  const cfg = await getWabaConfig();
  return apiOk({
    data: {
      connected: Boolean(cfg.phoneNumberId && cfg.accessToken),
      phone_number: cfg.phoneNumberDisplay,
      business_name: cfg.businessName,
      api_version: cfg.apiVersion,
    },
  });
});
