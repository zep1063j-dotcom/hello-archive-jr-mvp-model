import Link from "next/link";
import { Suspense } from "react";
import { InterestButton } from "@/components/interest-button";
import { Eyebrow, PageSkeleton } from "@/components/states";
import { PRODUCTS } from "@/lib/book-preview";
import { requireChild } from "@/lib/children";
import { getMyBookPreview, getMyInterests } from "@/lib/my-book";

export const metadata = { title: "제작 · Hello Archive jr" };

// 제작 탭 (D-036): 쌓인 기록으로 만들 수 있는 것들. 이야기 카드는 지금 만들 수 있고,
// PDF·종이책은 아직 만들지 않았다 — 책 한 권 분량을 미리 보여 주고 받아보고 싶은지 표시만 받는다.
export default function MakePage() {
  return (
    <>
      <header>
        <Eyebrow>Make something to keep</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">제작</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          쌓인 기록을 꺼내 보기 좋은 모양으로 만들어요.
        </p>
      </header>

      <Link
        href="/archive/chapters/1m"
        transitionTypes={["nav-forward"]}
        className="flex min-h-16 items-center justify-between gap-3 border border-ink px-4 py-3 hover:bg-blush"
      >
        <span>
          <span className="block font-serif text-lg font-bold">1개월 이야기 카드</span>
          <span className="block text-[13px] text-ink-soft">한 달 기록을 이미지 한 장으로 저장하고 공유해요</span>
        </span>
        <span aria-hidden>↗</span>
      </Link>

      <Suspense fallback={<PageSkeleton rows={3} />}>
        <BookSection />
      </Suspense>
    </>
  );
}

async function BookSection() {
  const child = await requireChild("/make");
  const [preview, interests] = await Promise.all([getMyBookPreview(child.id), getMyInterests()]);

  return (
    <>
      <section aria-labelledby="book-preview" className="flex flex-col gap-3">
        <h2 id="book-preview" className="border-b border-ink pb-2 font-serif text-lg font-bold">
          <span className="break-all">{child.nickname}</span>의 책 한 권
        </h2>
        {preview ? (
          <>
            <dl className="grid grid-cols-3 border border-ink text-center">
              <Stat label="기록" value={`${preview.entryCount}개`} />
              <Stat label="사진" value={`${preview.photoCount}장`} />
              <Stat label="기록한 달" value={`${preview.monthCount}개월`} />
            </dl>
            <p className="text-sm leading-relaxed text-ink-soft">
              {preview.firstMonthLabel === preview.lastMonthLabel
                ? `${preview.firstMonthLabel}`
                : `${preview.firstMonthLabel} ~ ${preview.lastMonthLabel}`}
              에 쓴 기록이 월별로 묶여 한 권이 돼요. 기록이 쌓일수록 책이 두꺼워져요.
            </p>
          </>
        ) : (
          <p className="border border-dashed border-ink-mute px-5 py-6 leading-relaxed text-ink-soft">
            아직 담을 기록이 없어요. 이번 주 질문에 답하면 여기서 책 한 권 분량을 볼 수 있어요.
          </p>
        )}
      </section>

      <section aria-labelledby="book-products" className="flex flex-col gap-6">
        <div>
          <h2 id="book-products" className="border-b border-ink pb-2 font-serif text-lg font-bold">
            곧 만들 수 있게 준비하고 있어요
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            아직 만들어 드릴 수는 없어요. 받아보고 싶은 것을 눌러 주시면 어떤 것부터 준비할지 정하는 데 참고하고, 출시되면 알려 드릴게요.
          </p>
        </div>
        {PRODUCTS.map((product) => (
          <article key={product.key} className="flex flex-col gap-3 border border-ink/30 p-4">
            <div>
              <h3 className="font-serif text-lg font-bold">{product.name}</h3>
              <p className="text-[13px] text-ink-soft">{product.summary}</p>
            </div>
            <p className="leading-relaxed">{product.detail}</p>
            <InterestButton product={product.key} initial={interests.has(product.key)} />
          </article>
        ))}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-ink px-1 py-4 first:border-l-0">
      <dt className="text-[11px] text-ink-soft">{label}</dt>
      <dd className="mt-1 font-serif text-xl font-bold">{value}</dd>
    </div>
  );
}
