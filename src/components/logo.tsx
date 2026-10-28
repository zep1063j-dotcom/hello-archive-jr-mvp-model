// 로고: 명조 "h" + 빨간 점, 옆에 Hello Archive jr (jr은 이탤릭 레드)
export function Logo() {
  return (
    <span className="inline-flex items-baseline gap-2.5">
      <span aria-hidden className="font-serif text-2xl font-bold leading-none">
        h<span className="text-brand">·</span>
      </span>
      <span className="text-[15px] font-bold tracking-tight">
        Hello Archive{" "}
        <span className="font-serif font-normal italic text-brand">jr</span>
      </span>
      {/* 지금은 베타 운영 중임을 알리는 작은 표시 */}
      <span className="self-center rounded-full border border-brand/40 px-1.5 py-px text-[10px] leading-4 font-semibold tracking-wider text-brand-deep">
        BETA
      </span>
    </span>
  );
}
