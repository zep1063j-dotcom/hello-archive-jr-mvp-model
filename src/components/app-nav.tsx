"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { Logo } from "@/components/logo";

const NAV_ITEMS = [
  { href: "/home", label: "홈", match: (p: string) => p === "/home" },
  { href: "/write", label: "기록 쓰기", match: (p: string) => p === "/write" },
  {
    href: "/archive",
    label: "아카이브",
    match: (p: string) => p.startsWith("/archive"),
  },
  { href: "/profile", label: "프로필", match: (p: string) => p === "/profile" },
] as const;

// `/archive/[entryId]`처럼 매개변수를 미리 알 수 없는 경로에서는 usePathname이 요청 시점에 정해져 Suspense가 필요하다.
// 그동안은 선택 표시 없는 같은 모양의 헤더를 보여준다.
export function AppNav() {
  return (
    <Suspense fallback={<NavBar pathname="" />}>
      <CurrentNavBar />
    </Suspense>
  );
}

function CurrentNavBar() {
  return <NavBar pathname={usePathname()} />;
}

// 상단 고정 헤더. 모바일은 로고 줄 아래에 메뉴 줄이 한 번 더, md 이상은 한 줄에 로고와 메뉴가 같이 들어간다.
function NavBar({ pathname }: { pathname: string }) {
  const currentIndex = NAV_ITEMS.findIndex((item) => item.match(pathname));

  return (
    <header className="sticky top-0 z-10 border-b border-ink bg-paper">
      <div className="mx-auto flex w-full max-w-2xl flex-col md:h-14 md:flex-row md:items-center md:justify-between md:px-6">
        <Link
          href="/home"
          aria-label="Hello Archive jr 홈"
          className="flex h-12 items-center px-5 md:h-auto md:px-0"
        >
          <Logo />
        </Link>

        <nav aria-label="주요 메뉴" className="border-t border-line md:border-t-0">
          <ul className="flex md:gap-6">
            {NAV_ITEMS.map((item, index) => {
              const active = item.match(pathname);
              // 메뉴 순서상 오른쪽 메뉴로 가면 앞으로, 왼쪽이면 뒤로 슬라이드
              const direction = index > currentIndex ? "nav-forward" : "nav-back";
              return (
                <li key={item.href} className="flex-1 md:flex-none">
                  <Link
                    href={item.href}
                    transitionTypes={active ? undefined : [direction]}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-11 items-center justify-center text-sm tracking-tight md:h-14 ${
                      active ? "font-bold text-ink" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <ViewTransition name="nav-indicator" share="auto">
                        <span
                          aria-hidden
                          className="absolute inset-x-3 bottom-0 h-[3px] bg-brand md:inset-x-0"
                        />
                      </ViewTransition>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
