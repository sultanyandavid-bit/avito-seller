import Workspace from "@/components/workspace";
import { sections, type Section } from "@/lib/types";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as Section)) notFound();
  return <Workspace section={section as Section} />;
}
