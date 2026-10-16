import DavioShell from "@/components/davio/shell";
import Projects from "@/components/davio/projects";
export default function Page() {
  return (
    <DavioShell active="listings">
      <Projects />
    </DavioShell>
  );
}
