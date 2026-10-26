// 자녀 원형 사진. 사진이 없으면 별명의 첫 글자를 보여 준다 (D-027). 사진 주소는 서버가 만든 짧게 유효한 서명 URL이다.
export function ChildAvatar({
  nickname,
  photoUrl,
  size = "md",
}: {
  nickname: string;
  photoUrl: string | null;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-24 text-4xl" : "size-14 text-2xl";
  return photoUrl ? (
    // 서명 URL(외부 저장소)이라 next/image 최적화를 쓰지 않는다. 사진은 이미 512px로 줄여 올렸다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={`${nickname} 사진`}
      width={size === "lg" ? 96 : 56}
      height={size === "lg" ? 96 : 56}
      className={`${box} shrink-0 rounded-full border border-blush-deep object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`${box} grid shrink-0 place-items-center rounded-full bg-blush-deep font-serif font-bold text-brand-deep`}
    >
      {nickname.charAt(0)}
    </span>
  );
}
