import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath } from "./auth-paths.ts";

describe("로그인 복귀 경로", () => {
  it("제작 화면을 포함한 앱 경로와 검색 조건을 유지한다", () => {
    for (const path of ["/make", "/home", "/write?week=2026-10-19", "/archive?q=test#records", "/profile?edit=1", "/yearly"]) {
      assert.equal(safeNextPath(path), path);
    }
  });
  it("외부 주소·제어 문자·경로 접두사 위장을 거부한다", () => {
    for (const path of [null, undefined, 1, "https://example.com", "//example.com", "/\\example.com", "/makeover", "/login", "/home\n", "/home\u007f"]) {
      assert.equal(safeNextPath(path), "/home");
    }
  });
  it("브라우저가 해석할 실제 경로를 검사해 우회 이동을 막는다", () => {
    assert.equal(safeNextPath("/archive/../login"), "/home");
    assert.equal(safeNextPath("/archive/%2e%2e/login"), "/home");
    assert.equal(safeNextPath("/archive/../make"), "/make");
  });
});
