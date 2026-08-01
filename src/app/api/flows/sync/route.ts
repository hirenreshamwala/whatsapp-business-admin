import { handle, ok, requireAdmin } from "@/lib/api";
import { syncFlows } from "@/lib/whatsapp/flow-service";

export const POST = handle(async () => {
  await requireAdmin();
  return ok(await syncFlows());
});
