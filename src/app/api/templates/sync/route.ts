import { handle, ok, requireAdmin } from "@/lib/api";
import { syncTemplates } from "@/lib/whatsapp/template-service";

export const POST = handle(async () => {
  await requireAdmin();
  const result = await syncTemplates();
  return ok(result);
});
