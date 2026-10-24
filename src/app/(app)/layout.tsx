import { AppNav } from "@/components/app-nav";
import { MockNotice } from "@/components/states";

// 인증이 필요한 영역의 공통 레이아웃. 보호 라우트(proxy)와 소유권 검증은 SESSION 03에서 붙인다.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 pt-5 pb-16 md:px-6">
        <MockNotice>● 미리보기 · 예시 데이터이며 저장되지 않아요</MockNotice>
        {children}
      </main>
    </>
  );
}
