import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getLocale } from "@/lib/i18n-server";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Typer Szóstego Seta",
  description:
    "Typer siatkarski: typuj tabelę, drabinkę i wyniki meczów. / Volleyball predictions: league tables, brackets and match scores.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        {/*
         * Pages live inside this <main> rather than being flex children of <body> directly.
         *
         * Every page is an `mx-auto max-w-*` container, and auto cross-axis margins switch a flex
         * item from stretching to sizing itself against its content. So on a 375px phone the
         * predictions page sized itself to the 1000px bracket track instead of to the viewport,
         * and everything inside inherited that width — the group cards ran to 992px and the drag
         * handles sat off-screen, reachable only by scrolling the whole page sideways.
         *
         * In a plain block container `mx-auto` centres and `max-w-*` caps, which is what those
         * classes were always meant to do. min-w-0 keeps the same thing from happening to <main>
         * itself. Every page shared the bug; only this one had content wide enough to show it.
         */}
        <main className="w-full min-w-0 flex-1">{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
