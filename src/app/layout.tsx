import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers/Providers";
import { ViewportGuard } from "@/components/layout/ViewportGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MediaVault",
    template: "%s · MediaVault",
  },
  description: "会员制媒体文件管理与流媒体播放平台",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MediaVault",
  },
  formatDetection: {
    telephone: false,
  },
};

/** Mobile-first viewport — cover notch / home indicator; avoid white overscroll flash */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full">
      <body className="h-full font-sans antialiased">
        <Providers>
          <ViewportGuard />
          <div id="app" className="app-root">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
