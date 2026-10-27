"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isProductKey } from "@/lib/book-preview";
import { createClient } from "@/lib/supabase/server";

// 제작(PDF·종이책) 관심 표시 켜기/끄기 (D-036). 소유자는 폼이 아니라 로그인한 부모로 정하고, 상품 키는 서버가 다시 검증한다.

export type InterestState = { interested: boolean; error?: string };

const FAILED = "저장하지 못했어요. 잠시 후 다시 눌러 주세요.";

export async function setProductInterest(
  previous: InterestState,
  formData: FormData,
): Promise<InterestState> {
  const user = await requireUser();
  const product = formData.get("product");
  const wanted = formData.get("intent") === "add";
  if (!isProductKey(product)) return { ...previous, error: FAILED };

  const supabase = await createClient();
  if (wanted) {
    const { error } = await supabase.from("product_interests").insert({ user_id: user.id, product });
    // 23505: 다른 탭에서 이미 눌렀다. 원하는 상태(표시됨)이므로 성공으로 본다.
    if (error && error.code !== "23505") {
      console.error("[interest] 관심 표시 저장 실패", error.code);
      return { ...previous, error: FAILED };
    }
  } else {
    const { error } = await supabase
      .from("product_interests")
      .delete()
      .eq("user_id", user.id)
      .eq("product", product);
    if (error) {
      console.error("[interest] 관심 표시 취소 실패", error.code);
      return { ...previous, error: FAILED };
    }
  }

  revalidatePath("/make");
  return { interested: wanted };
}
