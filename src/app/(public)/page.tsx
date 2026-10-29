import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Eyebrow, PrimaryLink } from "@/components/states";

// 소개 화면의 기록은 모두 가상의 예시다. 시작하기는 기존 로그인 경로를 쓴다.
export default function Landing() {
  return (
    <>
      <header className="public-masthead">
        <div className="masthead-inner">
          <Logo />
          <span className="masthead-note">아이의 말, 오래도록.</span>
        </div>
      </header>
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-intro">
            <Eyebrow>아이의 생각을 모으는 곳</Eyebrow>
            <h1 className="landing-title">
              오늘의<br />한마디를,
              <span>내일도 기억할 수 있게.</span>
            </h1>
            <p className="landing-description">
              매주 하나의 질문에 짧게 답하며<br className="hidden sm:block" /> 아이의 말과 생각, 일상을 남깁니다.
              <span className="mt-2 block">몇 줄이어도 괜찮아요.</span>
            </p>
            <div className="mt-8 md:mt-10">
              <PrimaryLink href="/login">이메일로 시작하기</PrimaryLink>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">
                비밀번호 없이, 메일로 받은 숫자 코드로 로그인해요.
              </p>
            </div>
          </div>
          <ExampleFlow />
        </section>
        <ol className="landing-principles">
          {[
            ["01", "매주 질문은 하나"],
            ["02", "텍스트로 가볍게"],
            ["03", "시간순으로 안전하게"],
          ].map(([num, text]) => (
            <li key={num}>
              <span className="font-serif text-sm text-brand">{num}</span>
              <span className="text-[14px]">{text}</span>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}

function ExampleFlow() {
  return (
    <section aria-labelledby="example" className="landing-specimen">
      <div className="specimen-caption">
        <h2 id="example">이렇게 남겨요</h2>
        <span>한 주의 기록</span>
      </div>
      <div className="specimen-page">
        <div className="specimen-dateline">
          <span>콩이의 기록장</span>
          <span>10월 27일</span>
        </div>
        <p className="specimen-question">오늘 제일 재미있었던 게 뭐야?</p>
        <blockquote className="specimen-quote">
          “블록으로 엄청 높은 탑을 쌓았는데,<br />무너져서 또 쌓았어!”
        </blockquote>
        <div className="specimen-footnote">
          <span>한 문장이면 충분해요.</span>
          <span aria-hidden>01</span>
        </div>
      </div>
      <div className="specimen-archive">
        <span className="font-serif text-[3.25rem] leading-none tracking-[-0.06em]">10<span className="ml-1 text-base">월</span></span>
        <div className="border-l border-line pl-5">
          <p className="font-serif text-base">한 달이 지나면, 이야기 카드로.</p>
          <p className="mt-1 text-[12px] text-ink-soft">콩이 · 기록 4개</p>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-mute">예시예요. 실제 아이의 기록이 아니에요.</p>
    </section>
  );
}
