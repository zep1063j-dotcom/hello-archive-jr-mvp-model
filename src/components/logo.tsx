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
    </span>
  );
}
