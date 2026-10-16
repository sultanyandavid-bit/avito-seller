import DavioShell from "@/components/davio/shell";
import Admin from "@/components/davio/admin";
export default function Page() {
  return (
    <DavioShell active="settings">
      <Admin />
    </DavioShell>
  );
}
