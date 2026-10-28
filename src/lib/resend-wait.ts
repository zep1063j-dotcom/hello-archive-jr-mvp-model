// 로그인 코드 "다시 받기" 대기 시간의 순수 계산. 코드를 보낸 시각부터 `RESEND_WAIT_SECONDS`초 동안은 다시 받을 수 없다.
// 서버(Supabase/Resend)의 발송 한도와는 별개의 화면 쪽 장치로, 너무 잦은 요청으로 막히는 것을 막는다.

export const RESEND_WAIT_SECONDS = 60;

/** `sentAt`(ms)에 보낸 코드를 `now`(ms)에 다시 받을 수 있기까지 남은 초. 보낸 적이 없으면 0. */
export function resendWaitSeconds(sentAt: number | undefined, now: number): number {
  if (sentAt === undefined) return 0;
  const elapsedSeconds = Math.floor((Math.max(now, sentAt) - sentAt) / 1000);
  return Math.max(0, RESEND_WAIT_SECONDS - elapsedSeconds);
}
