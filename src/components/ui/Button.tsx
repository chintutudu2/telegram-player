import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/utils/cn";
import { interactive, tone } from "./styles";

const variants = {
  primary: `${tone.active} font-medium hover:brightness-110`,
  glass: "glass text-fg hover:bg-white/12 hover:border-white/15",
  ghost: "text-muted hover:bg-white/5 hover:text-fg",
  danger: "bg-white/5 text-danger border border-white/5 hover:bg-danger/10",
} as const;

const sizes = {
  sm: "h-9 gap-1.5 px-4 text-sm",
  md: "h-11 gap-2 px-5 text-sm",
  lg: "h-12 gap-2.5 px-7 text-base",
  icon: "size-11 shrink-0 justify-center",
} as const;

export interface ButtonStyleProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}

export const buttonStyles = ({ variant = "glass", size = "md", className }: ButtonStyleProps = {}) =>
  cn(
    "inline-flex cursor-pointer items-center rounded-full whitespace-nowrap",
    interactive,
    variants[variant],
    sizes[size],
    className,
  );

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps;

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & ButtonStyleProps;

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}
