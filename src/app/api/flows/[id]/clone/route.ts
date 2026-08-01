import { handle, ok, requireAdmin } from "@/lib/api";
import { cloneFlow } from "@/lib/whatsapp/flow-service";

export const POST = handle(async (_req, { params }) => {
  await requireAdmin();
  return ok(await cloneFlow((await params).id));
});
