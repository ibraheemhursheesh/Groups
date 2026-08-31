import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { AccountSwitcher } from "@/components/account-switcher";
import { RealtimeProvider } from "@/components/realtime-provider";
import { NotificationsBell } from "@/components/notifications-bell";
import Link from "next/link";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sign in · Groupss",
  description: "Sign in to Groupss with Google",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Mounted here so the one SSE connection is opened once and survives
            every client-side navigation, rather than reconnecting per route. */}
        <RealtimeProvider>
          <Link href="/">Home</Link>
          <ThemeProvider>{children}</ThemeProvider>
          <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
            <NotificationsBell />
            <AccountSwitcher />
          </div>
        </RealtimeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
