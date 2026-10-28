import { redirect } from "next/navigation";

// 예전 주소. 첫 가입 환영 온보딩은 이제 홈 위의 창으로 뜬다 (D-040).
export default function OnboardingPage() {
  redirect("/home");
}
