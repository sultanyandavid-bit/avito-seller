import DavioShell from "@/components/davio/shell";
import DavioSettings from "@/components/davio/settings";
export default function Page() {
  return (
    <DavioShell active="settings">
      <DavioSettings />
    </DavioShell>
  );
}
