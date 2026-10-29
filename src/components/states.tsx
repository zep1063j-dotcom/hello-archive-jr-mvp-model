import Link from "next/link";
import type { ReactNode } from "react";

// 빈 상태 / 오류 상태 / 로딩 스켈레톤. 화면마다 반복되므로 한 곳에 둔다.

/** 작은 대문자 라벨 (빨간 점 + 트래킹) */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-brand-deep uppercase">
      <span aria-hidden className="h-px w-6 bg-brand" />
      {children}
    </p>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 w-full items-center justify-between bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep md:w-auto md:min-w-56 rounded-[2px]"
    >
      {children}
      <span aria-hidden>↗</span>
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="border-y border-line px-1 py-10 ">
      <p className="font-serif text-xl font-normal leading-snug">{title}</p>
      <p className="mt-3 leading-relaxed text-ink-soft">{description}</p>
      {action && (
        <div className="mt-6">
          <PrimaryLink href={action.href}>{action.label}</PrimaryLink>
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title = "문제가 생겼어요",
  description = "잠시 후 다시 시도해 주세요. 쓰던 내용은 이 화면을 벗어나기 전까지 남아 있어요.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="border-l-4 border-brand bg-sheet px-5 py-6 ">
      <p className="font-serif text-xl font-normal leading-snug">{title}</p>
      <p className="mt-3 leading-relaxed text-ink-soft">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-12 items-center border border-ink px-5 font-semibold hover:bg-ink hover:text-paper rounded-[2px]"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-paper-deep ${className} rounded-[2px]`} />;
}

// 메뉴를 옮길 때마다 뼈대가 번쩍였다 사라지지 않게, 뼈대는 잠깐(약 0.25초) 기다렸다가 부드럽게 나타난다.
// 금방 불러오면 뼈대 없이 바로 내용이 보이고, 오래 걸릴 때만 뼈대가 보인다.
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="불러오는 중" className="skeleton-delayed flex flex-col gap-5">
      <SkeletonBlock className="h-9 w-2/3" />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
