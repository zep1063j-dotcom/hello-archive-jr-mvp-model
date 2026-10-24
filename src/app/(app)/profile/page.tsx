import { Eyebrow } from "@/components/states";
import { formatAge, formatKoreanDate } from "@/lib/date";
import { MOCK_TODAY, mockChild } from "@/lib/mock-data";

export const metadata = { title: "프로필 · Hello Archive jr" };

// 자녀 정보 수정, 이메일 수신 설정, 로그아웃, 데이터 삭제 요청은 SESSION 04·07에서 연결한다.
// 지금은 읽기 전용 화면과 자리만 보여준다.
export default function ProfilePage() {
  return (
    <>
      <header>
        <Eyebrow>Profile</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-bold">프로필</h1>
      </header>

      <section aria-labelledby="child">
        <h2
          id="child"
          className="border-b border-ink pb-2 font-serif text-lg font-bold"
        >
          아이
        </h2>
        <dl className="divide-y divide-line">
          <div className="grid grid-cols-[5.5rem_1fr] gap-4 py-4">
            <dt className="text-ink-soft">별명</dt>
            <dd className="font-serif font-semibold">{mockChild.nickname}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-4 py-4">
            <dt className="text-ink-soft">생년월일</dt>
            <dd className="font-serif">
              {formatKoreanDate(`${mockChild.birthDate}T00:00:00+09:00`)}
              <span className="ml-2 text-sm text-ink-soft">
                {formatAge(mockChild.birthDate, MOCK_TODAY)}
              </span>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          disabled
          className="mt-2 min-h-12 w-full border border-line px-5 text-left text-ink-mute"
        >
          수정 (준비 중)
        </button>
      </section>

      <section aria-labelledby="email">
        <h2
          id="email"
          className="border-b border-ink pb-2 font-serif text-lg font-bold"
        >
          주간 질문 이메일
        </h2>
        <p className="mt-4 leading-relaxed text-ink-soft">
          매주 질문이 도착하면 메일로 알려 드려요. 수신 설정은 이메일 기능을 연결할
          때 이곳에서 바꿀 수 있어요.
        </p>
      </section>

      <section aria-labelledby="account" className="flex flex-col gap-2">
        <h2
          id="account"
          className="border-b border-ink pb-2 font-serif text-lg font-bold"
        >
          계정
        </h2>
        <button
          type="button"
          disabled
          className="mt-2 min-h-12 border border-line px-5 text-left text-ink-mute"
        >
          로그아웃 (준비 중)
        </button>
        <button
          type="button"
          disabled
          className="min-h-12 px-1 text-left text-sm text-ink-mute underline underline-offset-4"
        >
          데이터 삭제 요청 (준비 중)
        </button>
      </section>
    </>
  );
}
