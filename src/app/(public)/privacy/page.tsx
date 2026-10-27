import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "개인정보 처리방침 · Hello Archive jr" };

const EFFECTIVE = "2026년 10월 27일";

// 개인정보 처리방침. 서비스가 실제로 수집·보관·전송하는 것(D-035, ARCHITECTURE)에 맞춘 초안이며, 공개 전에 법률 검토가 필요하다.
export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy policy" title="개인정보 처리방침" effective={EFFECTIVE}>
      <LegalSection title="1. 수집하는 개인정보와 방법">
        <p>Hello Archive jr(이하 “서비스”)는 이용자가 직접 입력하거나 서비스를 쓰는 과정에서 아래 정보를 수집합니다.</p>
        <LegalList
          items={[
            <>
              <b className="text-ink">가입</b>: 이메일 주소 (필수)
            </>,
            <>
              <b className="text-ink">아이 등록</b>: 아이의 별명, 생년월일 (필수)
            </>,
            <>
              <b className="text-ink">기록</b>: 기록 본문, 바꾸거나 직접 쓴 질문, 매년 질문의 답, 첨부한 사진(기록당 최대 3장)과 아이 프로필 사진 (이용자가 입력한 만큼)
            </>,
            <>
              <b className="text-ink">설정</b>: 주간 질문 이메일 수신 동의 여부와 바꾼 시각
            </>,
            <>
              <b className="text-ink">자동 수집</b>: 로그인 상태를 유지하는 쿠키, 이메일 발송 상태 기록, 호스팅 서비스의 접속 기록(IP 주소 등), 공개 화면(소개·로그인·약관)의 방문 통계
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="2. 이용 목적">
        <LegalList
          items={[
            "기록 저장·조회, 월별 이야기 카드 제공 등 서비스 제공",
            "이메일 인증 코드를 통한 로그인과 본인 확인",
            "동의한 이용자에게 주간 질문 이메일 발송",
            "문의 대응과 삭제 요청 처리",
            "공개 화면 방문 통계 분석 (서비스 소개 개선)",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. 보유·이용 기간과 파기">
        <p>
          정보는 이용자가 삭제를 요청하거나 서비스를 종료할 때까지 보관하며, 삭제 요청을 받으면 계정과 기록·사진(저장된 파일 포함)을
          지체 없이 파기합니다. 법령에 따라 보존해야 하는 정보는 그 기간 동안 따로 보관합니다. 아래 수탁사가 자체 정책에 따라 보관하는
          발송 기록·통계는 수탁사의 보관 기간을 따릅니다.
        </p>
      </LegalSection>

      <LegalSection title="4. 제3자 제공">
        <p>서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 따른 요구가 있는 경우는 예외입니다.</p>
      </LegalSection>

      <LegalSection title="5. 처리 위탁과 국외 이전">
        <p>서비스 운영을 위해 아래 업체에 처리를 맡기고 있으며, 이용자 정보가 해외 업체로 전송될 수 있습니다.</p>
        <LegalList
          items={[
            <>
              <b className="text-ink">Supabase Inc.</b> — 로그인, 데이터베이스, 사진 파일 저장. 이전 항목: 이메일, 아이 별명·생년월일, 기록, 사진, 설정. 데이터는 아시아 지역 서버에 저장됩니다. 보유 기간: 삭제 요청 시까지.
            </>,
            <>
              <b className="text-ink">Vercel Inc.</b> — 웹 서비스 실행과 접속 기록. 이전 항목: 이용 중 주고받는 정보와 접속 기록(IP 주소 등). 서비스는 서울 지역에서 실행됩니다. 보유 기간: 업체 정책에 따름.
            </>,
            <>
              <b className="text-ink">Resend, Inc.</b> — 로그인 코드·주간 질문 이메일 발송. 이전 항목: 수신 이메일 주소, 발송 상태. 보유 기간: 업체 정책에 따름.
            </>,
            <>
              <b className="text-ink">Google LLC</b> — 공개 화면(소개·로그인·약관)의 방문 통계(Google Analytics). 이전 항목: 방문 화면, 기기·브라우저 정보, 광고 유입 구분 값, 쿠키 식별자. 로그인 이후 화면에서는 보내지 않습니다.
            </>,
          ]}
        />
        <p>이전 시점·방법은 이용자가 서비스를 이용하는 때에 네트워크로 전송되는 방식입니다. 이전을 원하지 않으면 서비스를 이용하지 않거나 삭제를 요청해 주세요.</p>
      </LegalSection>

      <LegalSection title="6. 아이의 개인정보">
        <p>
          서비스는 아이가 직접 가입하거나 이용하지 않습니다. 아이의 별명·생년월일·기록·사진은 아이의 보호자(법정대리인)인 이용자가
          입력합니다. 이용자는 아이의 정보를 입력하고 기록하는 것에 대한 책임과 동의의 주체이며, 실명 대신 별명을 쓰기를 권합니다.
          올린 사진은 저장하기 전에 이용자의 기기에서 크기를 줄이면서 위치 정보(GPS 등)를 지웁니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 이용자의 권리">
        <p>
          이용자는 언제든 자신의 정보를 보고 고치고 삭제하거나 처리를 멈추도록 요구하고, 동의를 거둘 수 있습니다. 아이 정보와
          주간 메일 수신은 프로필 화면에서 직접 바꿀 수 있고, 그 밖의 요청은{" "}
          <a className="underline underline-offset-4 hover:text-brand" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          로 보내 주세요. 본인 확인 후 지체 없이 처리합니다.
        </p>
      </LegalSection>

      <LegalSection title="8. 안전하게 지키기 위한 조치">
        <LegalList
          items={[
            "모든 통신은 HTTPS로 암호화합니다.",
            "계정별로 데이터를 분리하고, 데이터베이스가 본인의 기록만 읽고 쓰도록 막습니다.",
            "사진은 비공개 저장소에 보관하고, 일정 시간이 지나면 만료되는 주소로만 보여 줍니다.",
            "기록 본문과 아이 정보를 방문 통계나 서버 기록에 남기지 않습니다.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. 쿠키">
        <p>
          로그인 상태를 유지하기 위해 쿠키를 사용합니다(서비스 이용에 필요). 공개 화면에서는 방문 통계를 위해 Google Analytics 쿠키를
          사용하며, 로그인 이후 화면에서는 방문 통계를 수집하지 않습니다. 쿠키는 브라우저 설정에서 거부하거나 지울 수 있습니다. 거부하면
          로그인이 유지되지 않을 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="10. 개인정보 보호 책임자와 문의">
        <p>
          개인정보 보호 책임자: Hello Archive jr 운영자 · 문의 {CONTACT_EMAIL}. 개인정보 침해 신고나 상담은 개인정보침해신고센터(국번 없이 118)에도 할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="11. 처리방침의 변경">
        <p>이 방침을 바꿀 때는 시행 7일 전에 서비스 화면에 알립니다. 수집 항목이나 위탁이 늘어나는 변경은 30일 전에 알립니다.</p>
      </LegalSection>
    </LegalPage>
  );
}
