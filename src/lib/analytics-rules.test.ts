import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTrackedPath, pageLocation, trackedQuery } from "./analytics-rules.ts";

describe("공개 화면 측정 규칙", () => {
  it("소개와 로그인만 측정하고 앱 화면은 측정하지 않는다", () => {
    assert.ok(isTrackedPath("/"));
    assert.ok(isTrackedPath("/login"));
    assert.ok(isTrackedPath("/terms"));
    assert.ok(isTrackedPath("/privacy"));
    for (const path of ["/home", "/write", "/archive", "/archive/0a8e3f2e-0000-0000-0000-000000000000", "/archive/card/2026-10", "/profile", "/yearly", "/onboarding", "/unsubscribe", "/api/cron/weekly-email", "/login/", "/Login"]) {
      assert.equal(isTrackedPath(path), false, path);
    }
  });

  it("쿼리에서는 utm_*만 남긴다", () => {
    assert.equal(trackedQuery("?utm_source=meta&utm_campaign=beta&next=%2Farchive%2Fabc&email=a%40b.c&fbclid=xyz"), "?utm_source=meta&utm_campaign=beta");
    assert.equal(trackedQuery("?next=%2Fwrite"), "");
    assert.equal(trackedQuery(""), "");
    assert.equal(trackedQuery(`?utm_source=${"x".repeat(101)}`), "", "너무 긴 값은 버린다");
  });

  it("보내는 주소는 출처 + 경로 + utm만이고, 측정하지 않는 화면이면 null", () => {
    assert.equal(pageLocation("https://archivejr.helloblank.net", "/", "?utm_source=meta&x=1"), "https://archivejr.helloblank.net/?utm_source=meta");
    assert.equal(pageLocation("https://archivejr.helloblank.net", "/login", "?next=%2Fwrite"), "https://archivejr.helloblank.net/login");
    assert.equal(pageLocation("https://archivejr.helloblank.net", "/home", ""), null);
  });
});
