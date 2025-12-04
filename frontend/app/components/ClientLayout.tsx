"use client";

import { CreditsProvider } from "../contexts/CreditsContext";
import type { ReactNode } from "react";

export function ClientLayout({ children }: { children: ReactNode }) {
  return <CreditsProvider>{children}</CreditsProvider>;
}

