import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Logo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-3" aria-label={`${siteConfig.name} home`}>
      <svg viewBox="0 0 40 40" className="size-10 drop-shadow-[0_0_12px_rgb(0_240_255/0.45)]" aria-hidden>
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00f0ff" />
            <stop offset="1" stopColor="#0a8fa3" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="12" fill="url(#logo-gradient)" />
        <path d="M16 12.5v15l12-7.5-12-7.5Z" fill="#091e22" />
      </svg>
      <span className="text-2xl font-bold tracking-[0.3em] text-white uppercase">{siteConfig.name}</span>
    </Link>
  );
}
