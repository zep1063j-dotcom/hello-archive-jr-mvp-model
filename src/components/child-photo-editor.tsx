"use client";

import { useRef, useState } from "react";
import { removeChildPhoto, uploadChildPhoto } from "@/app/actions/photos";
import { ChildAvatar } from "@/components/child-avatar";
import { ImageResizeError, resizeAvatarPhoto } from "@/lib/image-resize";

// 프로필의 원형 사진 바꾸기·지우기 (D-027). 고른 사진은 브라우저에서 정사각형 512px로 줄여 올린다.
export function ChildPhotoEditor({
  nickname,
  photoUrl,
}: {
  nickname: string;
  photoUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 사진을 다시 골라도 이벤트가 오게
    if (!file || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await resizeAvatarPhoto(file);
      const form = new FormData();
      form.set("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const result = await uploadChildPhoto(form);
      setMessage(result.ok ? { kind: "ok", text: "프로필 사진을 바꿨어요." } : { kind: "error", text: result.error });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof ImageResizeError ? error.message : "사진을 올리지 못했어요. 잠시 후 다시 눌러 주세요.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await removeChildPhoto();
      setMessage(result.ok ? { kind: "ok", text: "사진을 지웠어요." } : { kind: "error", text: result.error });
    } catch {
      setMessage({ kind: "error", text: "사진을 지우지 못했어요. 잠시 후 다시 눌러 주세요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 border-b border-line py-4">
      <ChildAvatar nickname={nickname} photoUrl={photoUrl} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="sr-only"
          id="child-photo-input"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="min-h-11 border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          {busy ? "올리는 중…" : photoUrl ? "사진 바꾸기" : "사진 추가"}
        </button>
        {photoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="min-h-10 text-sm text-ink-soft underline underline-offset-4 hover:text-brand disabled:opacity-40"
          >
            사진 지우기
          </button>
        )}
        <p
          role={message?.kind === "error" ? "alert" : "status"}
          className={`text-sm ${message?.kind === "error" ? "text-brand-deep" : "text-ink-soft"}`}
        >
          {message?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
