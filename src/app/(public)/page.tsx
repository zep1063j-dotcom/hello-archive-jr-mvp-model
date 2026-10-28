import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Eyebrow, PrimaryLink } from "@/components/states";

// 소개 + 시작하기. 이미 로그인했다면 /login에서 proxy가 /home으로 보낸다.
export default function Landing() {
  return (
    <>
      <header className="border-b border-ink">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-5 md:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-5 py-14 md:px-6">
        <div>
          <Eyebrow>아이의 생각을 모으는 곳</Eyebrow>
          <h1 className="mt-5 font-serif text-[2.5rem] font-bold leading-[1.3]">
            오늘의 한마디를,
            <br />
            <span className="font-normal">내일도 기억할 수 있게.</span>
          </h1>
          <p className="mt-6 max-w-md leading-relaxed text-ink-soft">
            매주 하나의 질문에 짧게 답하며 아이의 말과 생각, 일상을 남깁니다.
            몇 줄이어도 괜찮아요.
          </p>
        </div>

        <ol className="grid overflow-hidden rounded-2xl border border-ink md:grid-cols-3">
          {[
            ["01", "매주 질문은 하나"],
            ["02", "텍스트로 가볍게"],
            ["03", "시간순으로 안전하게"],
          ].map(([num, text]) => (
            <li
              key={num}
              className="flex items-baseline gap-4 border-t border-ink px-5 py-4 first:border-t-0 md:flex-col md:gap-2 md:border-t-0 md:border-l md:first:border-l-0"
            >
              <span className="font-serif text-2xl text-ink-mute">{num}</span>
              <span className="font-medium">{text}</span>
            </li>
          ))}
        </ol>

        <ExampleFlow />

        <div>
          <PrimaryLink href="/login">이메일로 시작하기</PrimaryLink>
          <p className="mt-4 text-xs text-ink-mute">
            비밀번호 없이, 메일로 받은 숫자 코드로 로그인해요.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

// 실제 사용 예시 한 세트: 질문 1개 → 짧은 답변 → 저장된 기록 → 월별 카드. 실제 아이의 정보가 아니라 지어낸 예시다.
function ExampleFlow() {
  return (
    <section aria-labelledby="example" className="flex flex-col gap-4">
      <div>
        <h2 id="example" className="font-serif text-xl font-bold">
          이렇게 남겨요
        </h2>
        <p className="mt-1 text-[13px] text-ink-mute">예시예요. 실제 아이의 기록이 아니에요.</p>
      </div>
      <ol className="flex flex-col gap-3">
        <li className="rounded-2xl border border-blush-deep bg-blush px-5 py-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase">1 · 이번 주 질문</p>
          <p className="mt-2 font-serif text-lg leading-snug font-semibold">오늘 제일 재미있었던 게 뭐야?</p>
        </li>
        <li className="rounded-2xl border border-line bg-sheet px-5 py-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase">2 · 한 문장이면 충분해요</p>
          <p className="mt-2 font-serif leading-relaxed">“블록으로 엄청 높은 탑을 쌓았는데, 무너져서 또 쌓았어!”</p>
        </li>
        <li className="rounded-2xl border border-line bg-sheet px-5 py-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase">3 · 저장된 기록</p>
          <div className="mt-3 grid grid-cols-[3.5rem_1fr] gap-3">
            <span className="font-serif leading-none text-ink-mute">
              <span className="block text-3xl font-semibold tracking-tight">27</span>
              <span className="mt-1 block text-xs">10월</span>
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-brand">오늘 제일 재미있었던 게 뭐야?</span>
              <span className="mt-1 block font-serif leading-relaxed">블록으로 엄청 높은 탑을 쌓았는데, 무너져서 또 쌓았어!</span>
            </span>
          </div>
        </li>
        <li
          className="rounded-3xl px-6 py-5 shadow-[0_2px_10px_rgb(0_0_0/0.1)]"
          style={{ backgroundColor: "#eeeaf6", color: "#1d1a2b" }}
        >
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: "#554f6b" }}>
            4 · 한 달이 지나면 이야기 카드로
          </p>
          <div className="mt-2 flex items-end gap-4">
            <span className="font-serif text-6xl leading-none font-bold">10</span>
            <span className="pb-1 font-serif text-xl font-bold">월</span>
            <span className="ml-auto pb-1 text-[12px]" style={{ color: "#837d99" }}>
              콩이 · 기록 4개
            </span>
          </div>
          <p className="mt-3 border-l-2 pl-3 font-serif text-[15px] leading-snug" style={{ borderColor: "#d92f3e", color: "#554f6b" }}>
            오늘 제일 재미있었던 게 뭐야?
            <span className="mt-1 block" style={{ color: "#1d1a2b" }}>
              블록으로 엄청 높은 탑을 쌓았는데, 무너져서 또 쌓았어!
            </span>
          </p>
        </li>
      </ol>
    </section>
  );
}
