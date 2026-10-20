import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/shared/ui/Providers";
import { Nav } from "@/shared/ui/Nav";
import { Grain } from "@/shared/ui/Grain";
import { MotionToggle } from "@/shared/ui/MotionToggle";
import { IrisTransition } from "@/shared/transition/IrisTransition";

export const metadata: Metadata = {
  title: {
    default: "Little Black Fish",
    template: "%s · Little Black Fish",
  },
  description: "Little Black Fish is an animation studio making small, strange worlds.",
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-[100] bg-stage px-3 py-2">
            Skip to content
          </a>
          <Nav />
          {children}
          <MotionToggle />
          <Grain />
          <IrisTransition />
        </Providers>
      </body>
    </html>
  );
}
