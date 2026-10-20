import type { Metadata } from "next";
import { PuppetLab } from "@/features/series/PuppetLab";

export const metadata: Metadata = {
  title: "Puppet lab",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PuppetLab />;
}
