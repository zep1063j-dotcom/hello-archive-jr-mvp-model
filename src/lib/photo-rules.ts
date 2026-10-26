// 사진 업로드의 순수 규칙. Next.js에 묶이지 않는 순수 TS (D-015). 정책은 D-027.
//  - 클라이언트가 사진을 줄여(긴 변 1600px / 프로필은 512px 정사각) JPEG로 다시 저장해 올린다. 이 과정에서 위치(GPS) 등 EXIF가 사라진다.
//  - 서버는 클라이언트를 믿지 않고 크기와 파일 머리(매직 바이트)로 형식을 다시 확인한다.
//  - 저장 경로는 항상 `<부모 id>/<무작위 이름>.<확장자>` 이다(Storage RLS·DB 체크와 같은 규칙).

export const PHOTO_BUCKET = "photos";
export const MAX_PHOTOS_PER_ENTRY = 3;
/** 서버가 받는 사진 1장의 최대 크기. Server Actions 본문 한도(3MB)보다 작게 둔다. */
export const MAX_UPLOAD_BYTES = 2_500_000;
/** 서명 URL 유효 시간(초) */
export const SIGNED_URL_SECONDS = 60 * 60;

export type ImageKind = "jpeg" | "png" | "webp";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

/** 파일 머리로 JPEG/PNG/WebP 인지 판별한다. 확장자·클라이언트가 말한 형식은 믿지 않는다. */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // WebP: "RIFF" .... "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export const IMAGE_MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const IMAGE_EXT: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp" };

/** 새 사진의 저장 경로. `uniqueId`는 UUID. */
export function newPhotoPath(userId: string, uniqueId: string, kind: ImageKind): string {
  return `${userId}/${uniqueId}.${IMAGE_EXT[kind]}`;
}

/** 경로가 해당 부모의 폴더 안인지 (남의 경로로 지우거나 연결하는 것을 막는다). */
export function isOwnPhotoPath(userId: string, path: string): boolean {
  if (!path.startsWith(`${userId}/`)) return false;
  const name = path.slice(userId.length + 1);
  return /^[A-Za-z0-9_.-]+$/.test(name) && !name.includes("..");
}

export type UploadCheck = { ok: true; kind: ImageKind } | { ok: false; error: string };

export function checkUpload(bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, error: "사진 파일이 비어 있어요." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "사진이 너무 커요. 더 작은 사진을 골라 주세요." };
  const kind = detectImageKind(bytes);
  if (!kind) return { ok: false, error: "JPEG, PNG, WebP 사진만 올릴 수 있어요." };
  return { ok: true, kind };
}

/** 긴 변을 `maxSide`로 줄이는 크기(확대하지 않음). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** 가운데를 정사각형으로 잘라내는 영역(프로필 사진). */
export function centerSquare(width: number, height: number): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}
