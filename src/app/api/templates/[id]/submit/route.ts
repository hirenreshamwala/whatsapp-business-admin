import { handle, ok, requireAdmin } from "@/lib/api";
import { submitTemplate } from "@/lib/whatsapp/template-service";

export const POST = handle(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const result = await submitTemplate(id);
  return ok(result);
});
