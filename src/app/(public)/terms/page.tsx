import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "이용약관 · Hello Archive jr" };

const EFFECTIVE = "2026년 10월 27일";

// 이용약관. 서비스가 실제로 하는 일(D-035)에 맞춘 초안이며, 공개 전에 법률 검토가 필요하다.
export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms of service" title="이용약관" effective={EFFECTIVE}>
      <LegalSection title="제1조 (목적)">
        <p>
          이 약관은 Hello Archive jr(이하 “서비스”)를 운영하는 운영자(이하 “운영자”)와 서비스를 이용하는 분(이하 “이용자”) 사이의
          권리와 의무, 그 밖에 필요한 사항을 정합니다.
        </p>
      </LegalSection>

      <LegalSection title="제2조 (서비스 내용)">
        <p>서비스는 아이를 키우는 보호자가 아이의 말·생각·일상을 글로 기록하도록 돕습니다.</p>
        <LegalList
          items={[
            "매주 하나의 질문에 텍스트로 답하기 (질문을 바꾸거나 직접 쓸 수 있어요)",
            "기록에 사진 붙이기, 아이 프로필 사진 설정",
            "기록을 시간순·월별로 다시 보기, 검색, 매년 같은 질문에 답하기",
            "한 달의 기록으로 만드는 이야기 카드 이미지 저장·공유",
            "매주 질문을 알려 주는 이메일 (이용자가 선택해서 받아요)",
          ]}
        />
        <p>서비스는 현재 시험 운영(베타) 중이며 기능과 정책이 바뀌거나 중단될 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="제3조 (가입과 계정)">
        <p>
          서비스는 이메일로 받은 인증 코드로 가입하고 로그인합니다. 가입은 아이의 보호자(부모 또는 법정대리인)로서 만 14세 이상인
          분이 할 수 있습니다. 이용자는 본인이 사용하는 이메일 주소로 가입해야 하며, 계정 관리의 책임은 이용자에게 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="제4조 (이용자의 책임)">
        <LegalList
          items={[
            "이용자는 본인 아이의 기록을 남기는 용도로 서비스를 이용해야 합니다. 다른 사람의 개인정보나 사진을 그 사람의 동의 없이 올려서는 안 됩니다.",
            "법령에 어긋나거나 다른 사람의 권리를 침해하거나 아이에게 해가 되는 내용을 기록해서는 안 됩니다.",
            "아이의 실명 대신 별명을 쓰는 것을 권합니다.",
            "이용자가 기록·카드를 직접 공유(메신저·SNS 등)하는 것은 이용자의 판단과 책임으로 합니다.",
          ]}
        />
      </LegalSection>

      <LegalSection title="제5조 (기록의 권리와 이용)">
        <p>
          이용자가 쓴 기록과 올린 사진의 권리는 이용자에게 있습니다. 운영자는 기록과 사진을 서비스 제공 외의 목적으로 이용하거나
          제3자에게 제공하지 않으며, 장애 대응·삭제 요청 처리 등 불가피한 경우를 빼고는 기록 내용을 열람하지 않습니다.
        </p>
        <p>이야기 카드 이미지는 이용자의 기기에서 만들어지며 운영자의 서버에 저장되지 않습니다.</p>
      </LegalSection>

      <LegalSection title="제6조 (주간 질문 이메일)">
        <p>
          주간 질문 이메일은 이용자가 직접 켠 경우에만 보냅니다(기본은 받지 않음). 프로필 화면에서 언제든 끌 수 있고, 메일 하단의
          수신 거부 링크로도 끌 수 있습니다. 이 메일은 홍보가 아니라 서비스 이용을 돕는 안내입니다.
        </p>
      </LegalSection>

      <LegalSection title="제7조 (서비스의 변경·중단)">
        <p>
          운영자는 서비스의 전부 또는 일부를 바꾸거나 중단할 수 있으며, 가능한 한 서비스 화면이나 이메일로 미리 알립니다. 시험 운영
          기간에는 예고 없는 점검·장애가 있을 수 있고, 데이터의 영구 보관을 보장하지 않습니다. 소중한 기록은 이야기 카드 저장 등으로
          따로 보관해 두시길 권합니다.
        </p>
      </LegalSection>

      <LegalSection title="제8조 (탈퇴와 데이터 삭제)">
        <p>
          이용자는 언제든{" "}
          <a className="underline underline-offset-4 hover:text-brand" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          로 계정과 기록·사진의 삭제를 요청할 수 있습니다. 운영자는 본인 확인 후 계정과 모든 기록·사진을 지체 없이 삭제하며,
          삭제한 데이터는 되돌릴 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="제9조 (책임의 제한)">
        <p>
          운영자는 천재지변, 외부 서비스(호스팅·데이터베이스·이메일 발송 등)의 장애, 이용자의 기기·네트워크 문제처럼 운영자가 통제할
          수 없는 사유로 생긴 손해에 대해서는 책임을 지지 않습니다. 이용자가 약관을 어겨 생긴 문제의 책임은 이용자에게 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="제10조 (약관의 변경)">
        <p>약관을 바꿀 때는 시행 7일 전에 서비스 화면에 알립니다. 이용자에게 불리한 변경은 30일 전에 알립니다.</p>
      </LegalSection>

      <LegalSection title="제11조 (문의와 준거법)">
        <p>서비스 이용 문의는 {CONTACT_EMAIL}로 보내 주세요. 이 약관에는 대한민국 법을 적용합니다.</p>
      </LegalSection>
    </LegalPage>
  );
}
