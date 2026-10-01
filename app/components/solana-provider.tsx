"use client";

import { ClientProvider } from "@solana/react";
import type { ReactNode } from "react";
import { solanaClient } from "../lib/solana-client";

export function SolanaProvider({ children }: { children: ReactNode }) {
  return <ClientProvider client={solanaClient}>{children}</ClientProvider>;
}
