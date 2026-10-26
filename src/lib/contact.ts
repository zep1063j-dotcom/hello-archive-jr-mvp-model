// 베타 문의·삭제 요청 창구 (SESSION 09). 앱 화면에 그대로 보이는 공개 주소다.
export const CONTACT_EMAIL = "helloblank88@gmail.com";

// 제목만 채운다. 사용자 이메일·자녀 정보를 링크에 싣지 않는다.
export function contactHref(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
