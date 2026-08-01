import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FlowBuilder } from "../flow-builder";

export default async function EditFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <FlowBuilder flowId={(await params).id} />;
}
