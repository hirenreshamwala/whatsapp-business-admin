import { handle, ok, requireAdmin, HttpError } from "@/lib/api";
import { uploadTemplateMediaSample } from "@/lib/whatsapp/upload";

export const POST = handle(async (req) => {
  await requireAdmin();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file provided");

  const buffer = Buffer.from(await file.arrayBuffer());
  const handle = await uploadTemplateMediaSample({
    data: buffer,
    mimeType: file.type || "application/octet-stream",
    fileName: file.name || "sample",
  });

  return ok({ handle, filename: file.name, mime: file.type });
});
