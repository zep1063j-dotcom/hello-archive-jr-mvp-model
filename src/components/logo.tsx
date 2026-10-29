// 로고: Hello Archive jr 글자만 (jr은 이탤릭 레드)
export function Logo() {
  return (
    <span className="inline-flex items-baseline gap-3">
      <span className="font-serif text-[17px] font-semibold tracking-[-0.04em]">
        Hello Archive{" "}
        <span className="font-serif font-normal italic text-brand">jr</span>
      </span>
      {/* 지금은 베타 운영 중임을 알리는 작은 표시 */}
      <span className="ml-1 self-center border-l border-line pl-2 text-[8px] leading-4 font-medium tracking-[0.12em] text-ink-soft">
        BETA
      </span>
    </span>
  );
}
