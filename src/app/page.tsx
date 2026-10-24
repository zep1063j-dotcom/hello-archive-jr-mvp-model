// SESSION 00 임시 홈 화면. 실제 홈/로그인 분기는 SESSION 01 이후에 구현한다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-brand">
        hello archive jr
      </p>
      <h1 className="text-3xl font-bold leading-snug">
        아이의 말이 자라는 기록
      </h1>
      <p className="leading-relaxed text-ink-soft">
        매주 한 가지 질문에 짧게 답하며 아이의 생각과 일상을 남깁니다. 지금은
        서비스를 준비하고 있어요.
      </p>
    </main>
  );
}
