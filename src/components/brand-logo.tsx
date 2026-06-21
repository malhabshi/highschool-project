"use client";

import { useLogo } from "@/lib/branding";

// Shows the uploaded logo if set, otherwise the "Masar" wordmark.
export function BrandLogo({
  imgClassName = "max-h-9 w-auto",
  textClassName = "text-xl font-bold tracking-tight",
}: {
  imgClassName?: string;
  textClassName?: string;
}) {
  const { logo } = useLogo();

  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="Logo" className={imgClassName} />;
  }
  return <span className={textClassName}>Masar</span>;
}
