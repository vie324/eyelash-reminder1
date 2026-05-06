import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import type { Appearance } from "@clerk/ui";
import "./globals.css";
import localFont from "next/font/local";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "eyelash-reminder",
  description: "アイラッシュサロン向け LINEリマインド自動化ツール",
};

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const clerkAppearanceObject = {
  cssLayerName: "clerk",
  variables: { colorPrimary: "#111111" },
} satisfies Appearance;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <ClerkProvider ui={ui} appearance={clerkAppearanceObject}>
        <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
          {children}
        </body>
      </ClerkProvider>
    </html>
  );
}
