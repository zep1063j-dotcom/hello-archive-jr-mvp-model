// 브라우저에서 사진을 줄여 JPEG로 다시 저장한다 (D-027). 캔버스에 다시 그리므로 위치(GPS) 등 EXIF가 사라지고,
// 올리는 크기가 작아진다. 브라우저 전용(캔버스) — 서버 코드에서 부르지 않는다.
import { centerSquare, fitWithin } from "./photo-rules.ts";

export const ENTRY_PHOTO_MAX_SIDE = 1600;
export const AVATAR_SIZE = 512;

/** 줄이기에 실패하면 사용자에게 보일 문구를 담아 던진다. */
export class ImageResizeError extends Error {}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // 사진의 회전 정보(EXIF 방향)를 적용해 읽는다.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageResizeError("이 사진은 열 수 없어요. 다른 사진을 골라 주세요.");
  }
}

async function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new ImageResizeError("사진을 줄이지 못했어요. 다른 사진을 골라 주세요.");
  return blob;
}

/** 기록 사진: 긴 변을 1600px 이하로 줄인다. */
export async function resizeEntryPhoto(file: File): Promise<Blob> {
  const bitmap = await decode(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, ENTRY_PHOTO_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageResizeError("사진을 줄이지 못했어요.");
    context.drawImage(bitmap, 0, 0, width, height);
    return await toJpeg(canvas, 0.85);
  } finally {
    bitmap.close();
  }
}

/** 프로필 사진: 가운데를 정사각형으로 잘라 512px로. 화면에서 원 모양으로 보인다. */
export async function resizeAvatarPhoto(file: File): Promise<Blob> {
  const bitmap = await decode(file);
  try {
    const { x, y, size } = centerSquare(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageResizeError("사진을 줄이지 못했어요.");
    context.drawImage(bitmap, x, y, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return await toJpeg(canvas, 0.88);
  } finally {
    bitmap.close();
  }
}
