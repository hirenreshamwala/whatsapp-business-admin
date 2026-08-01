import { handle, ok, requireAdmin } from "@/lib/api";
import { uploadFlowDraft } from "@/lib/whatsapp/flow-service";

export const POST = handle(async (_req, { params }) => {
  await requireAdmin();
  return ok(await uploadFlowDraft((await params).id));
});
