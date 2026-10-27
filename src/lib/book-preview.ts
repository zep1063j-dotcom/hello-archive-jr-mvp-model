// 제작 탭(PDF·종이책)의 순수 규칙 (D-036). Next.js·브라우저에 묶이지 않는 순수 TS (D-015).
//  - 제작 상품 목록과 키 검증, 지금까지의 기록으로 "책 한 권 분량"을 요약한다.
//  - 실제 PDF 생성·주문은 아직 없다. 이 요약은 부모에게 책이 어떤 모습일지 보여 주기 위한 숫자다.
import { toKstDateKey } from "./date.ts";

export type ProductKey = "pdf" | "book";

export const PRODUCTS: { key: ProductKey; name: string; summary: string; detail: string }[] = [
  {
    key: "pdf",
    name: "PDF 파일",
    summary: "기록을 책 모양 파일로 받아요",
    detail: "월별로 묶인 기록과 사진이 한 권의 파일이 돼요. 휴대폰에 두고 보거나 가족에게 보낼 수 있어요.",
  },
  {
    key: "book",
    name: "종이책",
    summary: "손에 잡히는 한 권으로 받아요",
    detail: "같은 구성을 인쇄해서 집으로 보내 드리는 책이에요. 가격과 시기는 아직 정해지지 않았어요.",
  },
];

export function isProductKey(value: unknown): value is ProductKey {
  return PRODUCTS.some((product) => product.key === value);
}

export type BookPreview = {
  entryCount: number;
  photoCount: number;
  /** 기록이 있는 달의 수 (한국 시간 기준, 같은 달은 한 번만 센다. 첫 달부터 마지막 달까지의 길이가 아니다) */
  monthCount: number;
  /** 첫 기록과 마지막 기록이 속한 달: "2026.10" */
  firstMonthLabel: string;
  lastMonthLabel: string;
};

/**
 * 기록을 쓴 시각(`createdAts`, ISO)과 사진 수로 책 한 권 분량을 요약한다. 기록이 없으면 null.
 * 달은 한국 시간 기준으로 센다.
 */
export function summarizeBook(createdAts: string[], photoCount: number): BookPreview | null {
  if (createdAts.length === 0) return null;
  const months = [...new Set(createdAts.map((iso) => toKstDateKey(iso).slice(0, 7)))].sort();
  const label = (month: string) => month.replace("-", ".");
  return {
    entryCount: createdAts.length,
    photoCount,
    monthCount: months.length,
    firstMonthLabel: label(months[0]),
    lastMonthLabel: label(months[months.length - 1]),
  };
}
