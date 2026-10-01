import type { Metadata } from "next";
import "./globals.css";
import { SolanaProvider } from "./components/solana-provider";

export const metadata: Metadata = {
  title: "CH1KO - Proof of Skill",
  description: "Don't show us your diploma. Show us what you can build.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><SolanaProvider>{children}</SolanaProvider></body>
    </html>
  );
}
