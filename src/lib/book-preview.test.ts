import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProductKey, PRODUCTS, summarizeBook } from "./book-preview.ts";

describe("제작 상품 키", () => {
  it("목록에 있는 키만 통과한다", () => {
    assert.equal(isProductKey("pdf"), true);
    assert.equal(isProductKey("book"), true);
    assert.equal(isProductKey("card"), false);
    assert.equal(isProductKey(null), false);
    assert.equal(isProductKey(undefined), false);
  });

  it("DB 제약(product in ('pdf','book'))과 같은 키를 쓴다", () => {
    assert.deepEqual(PRODUCTS.map((product) => product.key), ["pdf", "book"]);
  });
});

describe("책 한 권 분량 요약", () => {
  it("기록이 없으면 null", () => {
    assert.equal(summarizeBook([], 0), null);
  });

  it("기록 수·사진 수·달 수와 첫/마지막 달을 센다", () => {
    const summary = summarizeBook(
      ["2026-10-27T03:00:00.000Z", "2026-10-13T03:00:00.000Z", "2026-12-01T03:00:00.000Z"],
      4,
    );
    assert.deepEqual(summary, {
      entryCount: 3,
      photoCount: 4,
      monthCount: 2,
      firstMonthLabel: "2026.10",
      lastMonthLabel: "2026.12",
    });
  });

  it("달은 한국 시간 기준이다 (UTC 10/31 20:00 = KST 11/1 05:00)", () => {
    const summary = summarizeBook(["2026-10-31T20:00:00.000Z"], 0);
    assert.equal(summary?.firstMonthLabel, "2026.11");
  });

  it("달이 하나면 처음과 마지막이 같다", () => {
    const summary = summarizeBook(["2026-10-05T03:00:00.000Z"], 0);
    assert.equal(summary?.monthCount, 1);
    assert.equal(summary?.firstMonthLabel, summary?.lastMonthLabel);
  });
});
