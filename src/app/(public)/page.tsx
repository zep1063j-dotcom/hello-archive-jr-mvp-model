import { Logo } from "@/components/logo";
import { Eyebrow, PrimaryLink } from "@/components/states";

// 소개 + 시작하기. 로그인 상태 분기(→ /home)와 /login 연결은 SESSION 03에서 한다.
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

        <ol className="grid border border-ink md:grid-cols-3">
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

        <div>
          <PrimaryLink href="/home">미리 둘러보기</PrimaryLink>
          <p className="mt-4 text-xs text-ink-mute">
            지금은 화면만 확인하는 단계예요. 로그인과 저장은 아직 연결되지 않았습니다.
          </p>
        </div>
      </main>
    </>
  );
}
