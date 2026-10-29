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
          const items = model.items.slice(0, 5);
          return (
            <li key={key} className="w-40 shrink-0 snap-start sm:w-44">
              <Link
                href={`/archive/card/${key}`}
                transitionTypes={["nav-forward"]}
                aria-label={`${cardTitle(model)}, ${model.yearLabel}년, 기록 ${model.entryCount}개${isOpen ? ", 진행 중" : ""}`}
                className="block shadow-[0_2px_10px_rgb(0_0_0/0.12)] transition-transform active:scale-[0.98]"
                style={{ backgroundColor: theme.photoBackground, color: theme.ink }}
              >
                <span className="flex aspect-[4/5] flex-col gap-2 p-3">
                  <span className="grid min-h-0 flex-1 grid-cols-2 gap-1.5" style={{ gridTemplateRows: items.length === 5 ? "1.4fr 1fr 1fr" : items.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                    {items.map((item, index) => (
                      <span key={index} className={`flex min-h-0 flex-col ${items.length === 1 || items.length === 2 || ((items.length === 3 || items.length === 5) && index === 0) ? "col-span-2" : ""}`}>
                        <span className="relative block min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: theme.background }}>
                          {/* 서명 URL을 그대로 쓴다. 축소 미리보기이며 파일은 비공개 Storage에 있다. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {item.photoUrl && <img src={item.photoUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[center_35%]" />}
                        </span>
                        <span className="py-0.5 text-[8px]" style={{ color: theme.soft }}>{item.dateLabel}</span>
                      </span>
                    ))}
                  </span>
                </span>
                <span className="flex flex-col gap-1 border-t px-3 py-2" style={{ borderColor: theme.line }}>
                  <span className="truncate font-serif text-[12px] font-semibold">{cardTitle(model)}</span>
                  <span className="text-[10px]" style={{ color: theme.mute }}>{model.yearLabel}년 · 기록 {model.entryCount}개{isOpen ? " · 진행 중" : ""}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
