import { ViewTransition } from "react";

// 메뉴 이동 시 페이지가 방향에 맞게 슬라이드한다. 방향은 <Link transitionTypes>로 정한다 (globals.css의 nav-forward / nav-back).
// 템플릿은 이동할 때마다 새로 만들어지므로 enter/exit가 실행된다 (레이아웃은 유지되어 실행되지 않는다).
const directional = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
} as const;

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={directional} exit={directional} default="none">
      <div className="flex flex-col gap-8">{children}</div>
    </ViewTransition>
  );
}
