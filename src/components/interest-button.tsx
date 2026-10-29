"use client";

import { useActionState } from "react";
import { setProductInterest, type InterestState } from "@/app/actions/product-interest";
import type { ProductKey } from "@/lib/book-preview";

// "받아보고 싶어요" 켜기/끄기. 서버 액션이 저장하고, 결과 상태로 버튼 모양이 바뀐다.
export function InterestButton({ product, initial }: { product: ProductKey; initial: boolean }) {
  const [state, formAction, pending] = useActionState<InterestState, FormData>(setProductInterest, {
    interested: initial,
  });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="intent" value={state.interested ? "remove" : "add"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={state.interested}
        className={`flex min-h-12 w-full items-center justify-between rounded-[2px] px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          state.interested
            ? "border border-ink bg-paper text-ink hover:bg-blush"
            : "bg-brand text-white hover:bg-brand-deep"
        }`}
      >
        {pending ? "저장하는 중…" : state.interested ? "받아보고 싶어요 ✓ (누르면 취소)" : "받아보고 싶어요"}
        <span aria-hidden>{state.interested ? "" : "↗"}</span>
      </button>
      {state.interested && !pending && (
        <p role="status" className="text-[13px] leading-relaxed text-ink-soft">
          출시되면 가입한 이메일로 한 번 알려 드릴게요.
        </p>
      )}
      {state.error && (
        <p role="alert" className="border-l-4 border-brand bg-sheet px-4 py-3 text-sm ">
          {state.error}
        </p>
      )}
    </form>
  );
}
