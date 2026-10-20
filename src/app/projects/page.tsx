import type { Metadata } from "next";
import { ArchivePage } from "@/features/archive/ArchivePage";

export const metadata: Metadata = {
  title: "Work",
  description: "Films, series and commissions by Little Black Fish.",
};

export default function Page() {
  return <ArchivePage />;
}
