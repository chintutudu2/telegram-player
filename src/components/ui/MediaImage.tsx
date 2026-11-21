"use client";

import { Film } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useState } from "react";
import { isOptimizableImage } from "@/config/images";
import { cn } from "@/utils/cn";

interface MediaImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  preload?: boolean;
  className?: string;
  /** Rendered instead of the default tile when there is no (working) image. */
  fallback?: ReactNode;
}

/** Fills its (relative) parent; falls back to a branded tile on missing/broken art. */
export function MediaImage({ src, alt, sizes, preload, className, fallback }: MediaImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    if (fallback) return fallback;
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "absolute inset-0 grid place-items-center bg-linear-to-br from-raised to-ink text-muted/40",
          className,
        )}
      >
        <Film className="size-1/4" aria-hidden />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      unoptimized={!isOptimizableImage(src)}
      onError={() => setFailedSrc(src)}
      className={cn("object-cover", className)}
    />
  );
}
