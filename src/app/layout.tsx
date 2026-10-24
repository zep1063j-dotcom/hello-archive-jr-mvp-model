import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR } from "next/font/google";
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
  title: "Hello Archive jr",
  description: "매주 한 가지 질문으로 아이의 말과 생각을 기록합니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f3eb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${notoSerifKr.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
