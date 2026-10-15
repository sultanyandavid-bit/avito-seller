import { notFound } from "next/navigation";
import Workspace from "@/components/workspace";
import { sections, type Section } from "@/lib/types";
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as Section)) notFound();
  return <Workspace section={section as Section} />;
}
