import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Eyebrow } from "@/components/states";

// 이용약관·개인정보 처리방침 공통 틀 (공개 화면, 로그인 없이 읽는다).
export function LegalPage({
  eyebrow,
  title,
  effective,
  children,
}: {
  eyebrow: string;
  title: string;
  effective: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-ink">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-5 md:px-6">
          <Link href="/" aria-label="Hello Archive jr 처음으로">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-12 md:px-6">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-snug">{title}</h1>
        <p className="mt-2 text-sm text-ink-mute">시행일 {effective}</p>
        <div className="mt-6">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="border-b border-ink pb-2 font-serif text-lg font-bold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 leading-[1.9] text-ink-soft">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2 border-l-2 border-line pl-4">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
