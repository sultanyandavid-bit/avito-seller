import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
/** Native control keeps mobile pickers and keyboard behavior; one shared arrow. */
export default function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`select-control ${className}`}>
      <select {...props}>{children}</select>
      <ChevronDown aria-hidden="true" size={18} />
    </span>
  );
}
