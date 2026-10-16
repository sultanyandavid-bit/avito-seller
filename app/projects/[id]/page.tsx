import DavioShell from "@/components/davio/shell";
import ProjectEditor from "@/components/davio/editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DavioShell active="listings">
      <ProjectEditor id={id} />
    </DavioShell>
  );
}
