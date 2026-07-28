import { prisma } from "@/lib/prisma";
import { handle, ok, requireUser, requireAdmin, HttpError } from "@/lib/api";
import { buildValidatedComponents, deleteTemplate } from "@/lib/whatsapp/template-service";
import type { TemplateBuilder } from "@/lib/whatsapp/template-types";

export const GET = handle(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) throw new HttpError(404, "Template not found");
  return ok(template);
});

export const PATCH = handle(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) throw new HttpError(404, "Template not found");
  if (!["LOCAL", "REJECTED"].includes(template.status)) {
    throw new HttpError(400, "Only local or rejected templates can be edited.");
  }

  const body = (await req.json()) as { builder: TemplateBuilder };
  const components = buildValidatedComponents(body.builder);

  const updated = await prisma.template.update({
    where: { id },
    data: {
      name: body.builder.name,
      language: body.builder.language,
      category: body.builder.category,
      components: components as object,
      status: "LOCAL",
      rejectionReason: null,
    },
  });
  return ok({ id: updated.id });
});

export const DELETE = handle(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await deleteTemplate(id);
  return ok({ deleted: true });
});
