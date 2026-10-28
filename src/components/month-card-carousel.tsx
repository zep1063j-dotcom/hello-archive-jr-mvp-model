import Link from "next/link";
import { cardTitle, seasonOfMonth, type MonthCardModel } from "@/lib/month-card";
import { CARD_THEMES } from "@/lib/month-card-theme";

export type CarouselCard = { key: string; isOpen: boolean; model: MonthCardModel };

// 아카이브 상단의 달별 이야기 카드 목록 (옆으로 스크롤, 최신 달이 맨 앞).
// 캔버스로 그린 진짜 카드(D-029)는 눌러서 들어간 카드 화면에서만 만든다 — 여기서는 같은 색의 가벼운 미리보기 타일만 보여
// 여러 달이 있어도 느려지지 않는다. 글자색·배경은 카드와 같은 계절 색(D-048)을 쓴다.
export function MonthCardCarousel({ cards }: { cards: CarouselCard[] }) {
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="month-cards">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="month-cards" className="font-serif text-lg font-bold">
          달마다 만든 이야기 카드
        </h2>
        <span className="text-[12px] text-ink-mute">옆으로 넘겨 보세요</span>
      </div>
      {/* 화면 가장자리까지 스크롤되고, 멈출 때 카드가 맞춰 선다 */}
      <ul className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 md:-mx-6 md:scroll-px-6 md:px-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {cards.map(({ key, isOpen, model }) => {
          const theme = CARD_THEMES[seasonOfMonth(model.month)];
          const latest = model.items[model.items.length - 1];
          return (
            <li key={key} className="w-40 shrink-0 snap-start sm:w-44">
              <Link
                href={`/archive/card/${key}`}
                transitionTypes={["nav-forward"]}
                aria-label={`${cardTitle(model)}, ${model.yearLabel}년, 기록 ${model.entryCount}개${isOpen ? ", 진행 중" : ""}`}
                className="flex aspect-[4/5] flex-col justify-between rounded-[1.75rem] p-4 shadow-[0_2px_10px_rgb(0_0_0/0.12)] transition-transform active:scale-[0.98]"
                style={{ backgroundColor: theme.background, color: theme.ink }}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wide" style={{ color: theme.soft }}>
                    {model.yearLabel}년 {model.monthLabel}
                  </span>
                  {isOpen && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: theme.accent, color: theme.background }}
                    >
                      진행 중
                    </span>
                  )}
                </span>
                <span className="flex flex-col gap-2">
                  <span className="line-clamp-2 font-serif text-[13px] leading-snug font-bold">{cardTitle(model)}</span>
                  <span aria-hidden className="h-[3px] w-6 rounded-full" style={{ backgroundColor: theme.accent }} />
                  {/* 가장 최근 기록의 답: 카드에서도 아이의 말이 가장 크게 보인다 */}
                  <span className="line-clamp-4 font-serif text-[15px] leading-snug font-semibold">{latest.answer}</span>
                </span>
                <span className="flex items-center justify-between gap-2 text-[11px]" style={{ color: theme.mute }}>
                  <span className="min-w-0 truncate">{latest.dateLabel}</span>
                  <span className="shrink-0">기록 {model.entryCount}개</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
