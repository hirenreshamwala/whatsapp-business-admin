import { handle, ok, requireAdmin } from "@/lib/api";
import { deprecateFlow } from "@/lib/whatsapp/flow-service";

export const POST = handle(async (_req, { params }) => {
  await requireAdmin();
  await deprecateFlow((await params).id);
  return ok({ status: "DEPRECATED" });
});
