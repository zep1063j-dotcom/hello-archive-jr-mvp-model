import { EmptyState } from "@/components/states";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <EmptyState
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 기록이에요."
        action={{ href: "/home", label: "홈으로" }}
      />
    </main>
  );
}
