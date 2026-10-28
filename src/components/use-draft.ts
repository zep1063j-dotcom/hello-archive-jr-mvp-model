"use client";

import { useSyncExternalStore } from "react";
import { readDraft, subscribeDrafts } from "@/lib/draft-store";

/** 이 기기에 남아 있는 초안(없으면 null). 서버 렌더링과 첫 그리기에서는 null이라 화면이 어긋나지 않는다. */
export function useStoredDraft(key: string): string | null {
  return useSyncExternalStore(
    subscribeDrafts,
    () => readDraft(key),
    () => null,
  );
}
