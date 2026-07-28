import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplateWizard } from "../wizard";

export default async function NewTemplatePage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <TemplateWizard />;
}
