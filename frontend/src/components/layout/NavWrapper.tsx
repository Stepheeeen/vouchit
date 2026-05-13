"use client";

import { usePathname } from "next/navigation";
import AppNav from "./AppNav";

export default function NavWrapper() {
  const pathname = usePathname();
  
  // Hide nav on landing page and auth pages
  const isMarketingOrAuth = pathname === "/" || pathname.startsWith("/auth");

  if (isMarketingOrAuth) {
    return null;
  }

  return <AppNav />;
}
