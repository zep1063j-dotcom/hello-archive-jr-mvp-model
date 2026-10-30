import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR } from "next/font/google";
import { Suspense } from "react";
import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

// 질문·기록 본문에 쓰는 명조. 한글 글리프는 필요한 조각만 내려받는다 (D-008).
const notoSerifKr = Noto_Serif_KR({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-noto-serif-kr",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://archivejr.helloblank.net"),
  title: "Hello Archive jr",
  description: "매주 한 가지 질문으로 아이의 말과 생각을 기록합니다.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Hello Archive jr",
    title: "Hello Archive jr · 아이의 생각을 모으는 곳",
    description: "오늘의 한마디를, 내일도 기억할 수 있게. 매주 하나의 질문으로 아이의 말과 일상을 남깁니다.",
    url: "/",
    // 이미지는 같은 폴더의 opengraph-image.png에서 자동으로 연결한다.
  },
  twitter: {
    card: "summary_large_image",
    title: "Hello Archive jr · 아이의 생각을 모으는 곳",
    description: "오늘의 한마디를, 내일도 기억할 수 있게. 매주 하나의 질문으로 아이의 말과 일상을 남깁니다.",
    images: [{
      url: "/opengraph-image.png",
      width: 1200,
      height: 630,
      alt: "Hello Archive jr — 오늘의 한마디를, 내일도 기억할 수 있게.",
    }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ec",
  // 모바일 키보드가 열리면 화면(레이아웃) 높이가 줄어, 가운데 정렬된 창과 입력란이 키보드에 가려지지 않는다.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${notoSerifKr.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* 공개 화면(소개·로그인)만 측정한다 (D-035). usePathname은 요청 시점에 정해져 Suspense가 필요하다. */}
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
      </body>
    </html>
  );
}
