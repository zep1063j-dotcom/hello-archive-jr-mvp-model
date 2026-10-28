// "이번 주 질문"과 "저장된 기록의 질문"을 구분하는 순수 규칙. Next.js에 묶이지 않는 순수 TS (D-015). 정책은 D-039.
//  - 같은 주에도 아이의 시기(stage)마다 질문 행이 따로 있다(D-038). 기록은 쓸 당시의 질문 행 하나에 매달린다.
//  - 지금 추천 질문(= 지금 시기의 질문 행)과 기록에 저장된 질문은 다를 수 있다: 기록 후에 생년월일을 고쳐 시기가 바뀌었거나,
//    시기별 질문이 생기기 전에 쓴 기록이 있을 때. 이때 완료된 기록은 항상 자기 질문 행의 질문으로 보여 준다.
//  - 한 주에 기록은 하나다. 다른 시기의 질문 행에 매달린 기록이어도 같은 주면 "이번 주 기록"이다.
import type { Entry, WeeklyQuestion } from "../types/archive.ts";

/** 그 주(`weekStart`)에 쓴 기록. 질문 행의 시기가 달라도 같은 주면 같은 기록으로 본다. 여러 개면 가장 먼저 쓴 것. */
export function entryOfWeek(entries: Entry[], weekStart: string): Entry | null {
  let found: Entry | null = null;
  for (const entry of entries) {
    if (entry.question.weekStart !== weekStart) continue;
    if (!found || entry.createdAt < found.createdAt) found = entry;
  }
  return found;
}

/**
 * 이번 주 카드에 보일 질문. 기록이 있으면 기록이 매달린 질문(저장 당시의 질문), 없으면 지금 시기의 추천 질문.
 * 기록이 있는데 추천 질문이 없는(시기 질문이 소진된) 경우도 기록의 질문으로 카드를 보인다.
 */
export function questionForWeekCard(
  recommended: WeeklyQuestion | null,
  entry: Entry | null,
): WeeklyQuestion | null {
  return entry ? entry.question : recommended;
}
