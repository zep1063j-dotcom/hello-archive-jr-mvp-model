"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isTrackedPath, pageLocation } from "@/lib/analytics-rules";

// 공개 화면(소개·로그인) 방문 측정, GA4 (D-035). 측정 ID가 없으면(.env.local 등) 아무것도 하지 않는다.
// 앱 안(로그인 이후)에서는 보내지 않는다: 소개 화면에서 앱으로 화면 전환을 해도 스크립트가 남아 있으므로
// 측정하지 않는 화면에서는 GA의 공식 끄기 스위치(`window['ga-disable-ID']`)를 켠다.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [disableKey: `ga-disable-${string}`]: boolean | undefined;
  }
}

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * gtag 명령 대기열을 만들고 설정을 한 번만 넣는다. 스크립트(`gtag/js`)가 내려오기 전에도 명령을 순서대로 쌓아 두므로,
 * 화면이 먼저 그려지고 스크립트가 나중에 오더라도 첫 방문이 빠지지 않는다.
 */
function ensureGtag(measurementId: string) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      // GA는 배열이 아니라 `arguments` 객체가 쌓여 있어야 명령으로 읽는다.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }
  return window.gtag;
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const tracked = Boolean(MEASUREMENT_ID) && isTrackedPath(pathname);

  useEffect(() => {
    if (!MEASUREMENT_ID) return;
    window[`ga-disable-${MEASUREMENT_ID}`] = !tracked;
    if (!tracked) return;
    const location = pageLocation(window.location.origin, pathname, window.location.search);
    if (!location) return;
    ensureGtag(MEASUREMENT_ID)("event", "page_view", {
      page_location: location,
      page_path: pathname,
      page_title: document.title,
    });
  }, [tracked, pathname]);

  // 측정하지 않는 화면에서 처음 열린 경우에는 스크립트를 아예 내려받지 않는다.
  if (!MEASUREMENT_ID || !tracked) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`} strategy="afterInteractive" />;
}
