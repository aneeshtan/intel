import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { APP_FOOTER_COPY } from "@/lib/app-version";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "IQX Intelligence",
  description:
    "IQX Intelligence is a maritime media monitoring platform for tracking keywords, narratives, competitors, and risk signals across LinkedIn, Reddit, and industry news.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable} antialiased`}>
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-stone-200/80 bg-white/70 px-6 py-4 text-center text-xs tracking-[0.14em] text-stone-500 uppercase backdrop-blur sm:px-10 lg:px-12">
            {APP_FOOTER_COPY}
          </footer>
        </div>
      </body>
    </html>
  );
}
