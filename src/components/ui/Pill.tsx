import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";
import { interactive, tone } from "./styles";

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Toggleable filter chip. */
export function Pill({ active = false, className, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "h-11 shrink-0 cursor-pointer rounded-full px-6 text-sm sm:text-[15px]",
        interactive,
        active ? tone.active : tone.idle,
        className,
      )}
      {...props}
    />
  );
}
