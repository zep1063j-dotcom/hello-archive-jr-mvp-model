"use client";

import { useEffect, useRef, useState } from "react";
import { deleteEntryPhoto, uploadEntryPhoto } from "@/app/actions/photos";
import { ImageResizeError, resizeEntryPhoto } from "@/lib/image-resize";
import { MAX_PHOTOS_PER_ENTRY } from "@/lib/photo-rules";
import type { EntryPhoto } from "@/types/archive";

// 기록(메모)에 사진 붙이기 (D-027). 고른 사진은 브라우저에서 줄여 두었다가(대기), 글을 저장한 뒤 한 장씩 올린다.
// 이미 올라간 사진을 지우는 것은 바로 서버에 반영한다. 기록 하나에 최대 3장.

type Queued = { key: string; blob: Blob; previewUrl: string };

export function useEntryPhotos(existing: EntryPhoto[]) {
  const [queued, setQueued] = useState<Queued[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 비동기 업로드·정리 코드가 최신 대기 목록을 읽도록 ref에 복사해 둔다(렌더 중에는 쓰지 않는다).
  const queuedRef = useRef<Queued[]>([]);
  useEffect(() => {
    queuedRef.current = queued;
  }, [queued]);

  // 화면을 떠날 때 미리보기 주소를 해제한다.
  useEffect(
    () => () => {
      queuedRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const visibleExisting = existing.filter((photo) => !removedIds.includes(photo.id));
  const remaining = MAX_PHOTOS_PER_ENTRY - visibleExisting.length - queued.length;

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const next: Queued[] = [];
      let slots = remaining;
      for (const file of Array.from(files)) {
        if (slots <= 0) {
          setError(`사진은 기록 하나에 ${MAX_PHOTOS_PER_ENTRY}장까지 붙일 수 있어요.`);
          break;
        }
        const blob = await resizeEntryPhoto(file);
        next.push({ key: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) });
        slots -= 1;
      }
      setQueued((current) => [...current, ...next]);
    } catch (caught) {
      setError(caught instanceof ImageResizeError ? caught.message : "사진을 불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function removeQueued(key: string) {
    setQueued((current) => {
      const target = current.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.key !== key);
    });
  }

  async function removeExisting(photoId: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await deleteEntryPhoto({ photoId });
      if (result.ok) setRemovedIds((current) => [...current, photoId]);
      else setError(result.error);
    } catch {
      setError("사진을 지우지 못했어요. 잠시 후 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  /** 대기 중인 사진을 기록에 한 장씩 올린다. 올라간 것은 대기에서 빼고, 실패한 장 수를 돌려준다. */
  async function uploadQueued(entryId: string): Promise<{ failed: number; message: string | null }> {
    let failed = 0;
    let message: string | null = null;
    for (const item of queuedRef.current) {
      try {
        const form = new FormData();
        form.set("entryId", entryId);
        form.set("file", new File([item.blob], "photo.jpg", { type: "image/jpeg" }));
        const result = await uploadEntryPhoto(form);
        if (result.ok) {
          removeQueued(item.key);
        } else {
          failed += 1;
          message = result.error;
        }
      } catch {
        failed += 1;
        message = "사진을 올리지 못했어요.";
      }
    }
    return { failed, message };
  }

  function reset() {
    queuedRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setQueued([]);
    setRemovedIds([]);
    setError(null);
  }

  return { queued, visibleExisting, remaining, error, busy, addFiles, removeQueued, removeExisting, uploadQueued, reset };
}

export type EntryPhotosState = ReturnType<typeof useEntryPhotos>;

const thumb = "relative size-20 shrink-0 overflow-hidden border border-line bg-paper-deep";

/** 작성·수정 칸의 사진 영역: 올라간 사진, 대기 중인 사진, 추가 버튼. */
export function EntryPhotoField({ photos, disabled }: { photos: EntryPhotosState; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = disabled || photos.busy;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {photos.visibleExisting.map((photo) => (
          <div key={photo.id} className={thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="붙인 사진" className="size-full object-cover" />
            <RemoveButton label="사진 지우기" disabled={locked} onClick={() => photos.removeExisting(photo.id)} />
          </div>
        ))}
        {photos.queued.map((item) => (
          <div key={item.key} className={`${thumb} border-dashed border-brand`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.previewUrl} alt="올릴 사진 미리보기" className="size-full object-cover" />
            <RemoveButton label="올릴 사진 빼기" disabled={locked} onClick={() => photos.removeQueued(item.key)} />
          </div>
        ))}
        {photos.remaining > 0 && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                void photos.addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={locked}
              className="grid size-20 shrink-0 place-items-center border border-dashed border-ink/40 text-center text-xs text-ink-soft hover:border-ink hover:bg-sheet disabled:opacity-40"
            >
              <span>
                <span aria-hidden className="block text-xl leading-none">
                  +
                </span>
                {photos.busy ? "불러오는 중" : "사진 추가"}
              </span>
            </button>
          </>
        )}
      </div>
      {photos.error && (
        <p role="alert" className="text-sm text-brand-deep">
          {photos.error}
        </p>
      )}
    </div>
  );
}

function RemoveButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="absolute top-0.5 right-0.5 grid size-7 place-items-center rounded-full bg-ink/70 text-sm text-paper hover:bg-ink disabled:opacity-40"
    >
      <span aria-hidden>×</span>
    </button>
  );
}

/**
 * 기록 상세의 큰 사진 보기. 원본 크기와 상관없이 가로를 꽉 채워 키우고 가운데에 놓는다
 * (세로로 아주 긴 사진은 화면 높이 안에 맞춘다).
 */
export function PhotoGallery({ photos }: { photos: EntryPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <ul className="flex flex-col gap-4" aria-label={`붙인 사진 ${photos.length}장`}>
      {photos.map((photo) => (
        // 사진이 오기 전에도 자리를 잡아 두어(min-h) 글이 아래로 밀리지 않게 한다. 맨 위쪽에 있는 사진이라 바로 불러온다.
        <li key={photo.id} className="flex min-h-40 justify-center border border-line bg-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt="붙인 사진"
            className="block h-auto max-h-[80vh] w-full object-contain"
          />
        </li>
      ))}
    </ul>
  );
}

/** 읽기 전용 사진 줄 (저장된 기록·아카이브). */
export function PhotoStrip({ photos, size = "md" }: { photos: EntryPhoto[]; size?: "sm" | "md" }) {
  if (photos.length === 0) return null;
  const box = size === "sm" ? "size-12" : "size-24";
  return (
    <ul className="flex flex-wrap gap-2" aria-label={`붙인 사진 ${photos.length}장`}>
      {photos.map((photo) => (
        <li key={photo.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="붙인 사진" className={`${box} border border-line object-cover`} loading="lazy" />
        </li>
      ))}
    </ul>
  );
}
