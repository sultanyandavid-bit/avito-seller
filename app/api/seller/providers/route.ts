import { publicCatalog } from "@/lib/seller/server/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(publicCatalog(), {
    headers: { "Cache-Control": "no-store" },
  });
}
