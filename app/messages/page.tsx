import DavioShell from "@/components/davio/shell";
import DavioMessages from "@/components/davio/messages";
export default function Page() {
  return (
    <DavioShell active="messages">
      <DavioMessages />
    </DavioShell>
  );
}
