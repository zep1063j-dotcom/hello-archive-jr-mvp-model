"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteEntry,
  updateEntry,
  type DeleteEntryState,
} from "@/app/actions/entries";
import { canSubmitBody, EntryBodyField } from "@/components/entry-body-field";
import { EntryPhotoField, PhotoGallery, useEntryPhotos } from "@/components/entry-photo-field";
import { useStoredDraft } from "@/components/use-draft";
import { draftKey, removeDraft, writeDraft } from "@/lib/draft-store";
import type { EntryPhoto } from "@/types/archive";

type Mode = "view" | "edit" | "confirm-delete";

const SAVE_ERROR = "저장하지 못했어요. 쓴 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.";

const secondaryButton =
  "min-h-12 border border-ink/30 px-5 text-sm hover:border-ink hover:bg-sheet disabled:cursor-not-allowed disabled:opacity-40 rounded-xl";

// 기록 상세의 본문 + 수정·삭제. 삭제는 되돌릴 수 없어 한 번 더 확인한다.
// 수정은 이번 주가 아닌 지난 기록에도 허용한다(오타 수정 등, 본문만 바뀐다). 질문은 여기서 바뀌지 않는다 (D-039).
// 고치는 중인 글은 이 기기에 계정별 초안으로 남고, 취소하면 저장된 원본이 그대로 남는다 (D-041).
export function EntryDetailBody({
  entryId,
  userId,
  body,
  photos: savedPhotos,
}: {
  entryId: string;
  userId: string;
  body: string;
  photos: EntryPhoto[];
}) {
  const [mode, setMode] = useState<Mode>("view");
  const key = draftKey(userId, `edit:${entryId}`);
  const stored = useStoredDraft(key);
  const [typed, setTyped] = useState<string | null>(null);
  const draft = typed ?? stored ?? body;
  function setDraft(next: string) {
    setTyped(next);
    if (next === body) removeDraft(key);
    else writeDraft(key, next);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 삭제는 폼 액션이다. 성공하면 서버가 아카이브로 이동시키고, 실패하면 상태로 오류 문구를 돌려받는다.
  const [deleteState, deleteAction, deleting] = useActionState<DeleteEntryState, FormData>(
    deleteEntry,
    {},
  );
  const photos = useEntryPhotos(savedPhotos);
  const pending = saving || deleting || photos.busy;
  // 저장 직후 서버 데이터가 도착하기 전까지 방금 저장한 내용을 보여준다 (옛 본문이 잠깐 보이는 것을 막는다).
  const [savedBody, setSavedBody] = useState<string | null>(null);
  const [seenBody, setSeenBody] = useState(body);
  if (seenBody !== body) {
    setSeenBody(body);
    setSavedBody(null);
  }
  const shownBody = savedBody ?? body;
  const message = error ?? deleteState.error ?? null;

  useEffect(() => {
    if (mode === "edit") textareaRef.current?.focus();
  }, [mode]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canSubmitBody(draft)) return; // 저장 중 중복 제출 방지
    setSaving(true);
    setError(null);
    try {
      const result = await updateEntry({ entryId, body: draft });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      removeDraft(key); // 글은 서버에 저장됐다
      if (photos.queued.length > 0) {
        const upload = await photos.uploadQueued(entryId);
        if (upload.failed > 0) {
          setSavedBody(draft.trim());
          setError(`글은 저장했어요. 사진 ${upload.failed}장은 올리지 못했어요. ${upload.message ?? ""} 수정 저장을 다시 눌러 주세요.`.trim());
          return;
        }
      }
      setSavedBody(draft.trim());
      setTyped(null);
      photos.reset();
      setMode("view");
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  if (mode === "edit") {
    return (
      <form onSubmit={handleSave} noValidate className="mt-6 flex flex-col gap-3">
        <EntryBodyField
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setError(null);
          }}
          textareaRef={textareaRef}
          rows={8}
          tone="paper"
          status={
            <>
              {saving && <span className="text-ink-soft">저장하는 중…</span>}
              {message && (
                <span role="alert" className="text-brand-deep">
                  {message}
                </span>
              )}
            </>
          }
        />
        <EntryPhotoField photos={photos} disabled={saving} />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || !canSubmitBody(draft)}
            className="flex min-h-12 flex-1 items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand rounded-xl"
          >
            {saving ? "저장하는 중…" : "수정 저장"}
            <span aria-hidden>↗</span>
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              // 고치던 내용을 버리고 저장된 원본을 그대로 둔다
              setTyped(null);
              removeDraft(key);
              setMode("view");
              setError(null);
            }}
            className={secondaryButton}
          >
            취소
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <p className="mt-6 whitespace-pre-wrap font-serif text-[1.0625rem] leading-[2]">
        {shownBody}
      </p>
      <div className="mt-6">
        <PhotoGallery photos={photos.visibleExisting} />
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {mode === "confirm-delete" ? (
          <div
            role="alertdialog"
            aria-label="기록 삭제 확인"
            className="border-l-4 border-brand bg-sheet px-5 py-5 rounded-r-xl"
          >
            <p className="font-serif text-lg font-semibold">이 기록을 삭제할까요?</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              삭제하면 되돌릴 수 없어요. 같은 주 질문에는 새로 다시 적을 수 있어요.
            </p>
            <div className="mt-4 flex gap-2">
              <form action={deleteAction} className="flex flex-1">
                <input type="hidden" name="entryId" value={entryId} />
                <button
                  type="submit"
                  disabled={pending}
                  className="min-h-12 flex-1 bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep disabled:opacity-40 rounded-xl"
                >
                  {deleting ? "삭제하는 중…" : "삭제하기"}
                </button>
              </form>
              <button
                type="button"
                autoFocus
                disabled={pending}
                onClick={() => setMode("view")}
                className={secondaryButton}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("edit");
              }}
              className={secondaryButton}
            >
              수정하기
            </button>
            <button
              type="button"
              onClick={() => setMode("confirm-delete")}
              className="min-h-12 px-3 text-sm text-ink-soft underline underline-offset-4 hover:text-brand"
            >
              삭제
            </button>
          </div>
        )}
        <p aria-live="polite" className="min-h-5 text-sm">
          {message && (
            <span role="alert" className="text-brand-deep">
              {message}
            </span>
          )}
        </p>
      </div>
    </>
  );
}
