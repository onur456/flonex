import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const facebookDomainVerification =
  process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION?.trim() ||
  "32ru78yosi47s32w584z8q9rko6mlh";

const tiktokVerification =
  process.env.NEXT_PUBLIC_TIKTOK_VERIFICATION_CODE?.trim();

export const metadata: Metadata = {
  title: "Flonex",
  description: "Generate studio-quality media and publish in one click",
  verification: {
    other: {
      "facebook-domain-verification": facebookDomainVerification,
      ...(tiktokVerification
        ? { "tiktok-developers-site-verification": tiktokVerification }
        : {}),
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
