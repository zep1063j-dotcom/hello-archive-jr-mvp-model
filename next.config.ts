import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 개발 중 화면 모서리에 뜨는 Next.js 'N' 아이콘은 서비스 화면이 아니므로 끈다.
  devIndicators: false,
  // 사진 업로드 서버 액션(D-027): 클라이언트가 줄인 사진 1장(약 1~2MB)을 받는다. 기본값 1MB는 부족하고, Vercel 요청 본문 한도(4.5MB) 안에서 3MB로 둔다.
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    // 개발 중 "Could not validate `instant`" 콘솔 오류를 끈다. 개발 서버가 모든 페이지를 로그인 정보 없이 미리 그려 보는 검증인데,
    // 로그인이 필요한 화면은 로그인 확인(requireUser)에서 /login으로 이동해 항상 이 경고가 난다. 실제 동작·프로덕션과는 무관하다.
    // `instant`를 직접 내보낸 화면만 검증한다 (docs: guides/instant-navigation).
    instantInsights: { validationLevel: "manual-warning" },
  },
  // 기본 보안 헤더 (SESSION 08). CSP는 인라인 스크립트 영향 검증이 필요해 아직 넣지 않았다.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
