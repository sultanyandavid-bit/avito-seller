import { Camera, Headphones, Package } from "lucide-react";
import type { Product } from "@/lib/types";
export default function ProductArt({
  kind,
  small = false,
}: {
  kind: Product["visual"];
  small?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`product-art ${kind} ${small ? "small" : ""}`}
    >
      {kind === "phone" ? (
        <div className="phone-body">
          <div className="lenses">
            <i />
            <i />
            <i />
          </div>
          <span>●</span>
        </div>
      ) : kind === "laptop" ? (
        <div className="laptop-body">
          <div />
          <i />
        </div>
      ) : kind === "headphones" ? (
        <Headphones size={small ? 30 : 90} strokeWidth={1.4} />
      ) : kind === "camera" ? (
        <Camera size={small ? 30 : 90} strokeWidth={1.4} />
      ) : (
        <Package size={48} />
      )}
    </div>
  );
}
