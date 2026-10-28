"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardTitle,
  layoutHeader,
  layoutStory,
  seasonOfMonth,
  STORY,
  wrapText,
  type MeasureFor,
  type MonthCardModel,
} from "@/lib/month-card";
import { CARD_THEMES, type CardTheme } from "@/lib/month-card-theme";

// 1개월 이야기 카드 (D-029). 캔버스에 그려서 화면에 보여 주고, 같은 캔버스를 PNG로 저장·공유한다
// (보이는 것과 저장되는 것이 같다). 카드는 부모의 기기 안에서만 만들어지고 서버로 올라가지 않는다.
// 이야기 면은 아이의 답이 가장 크게, 사진 면은 사진 한 장과 날짜 (D-048). 색은 카드 대상 달의 계절을 따른다.
// 바깥 모서리도 둥글게 자른다(모서리 바깥은 투명).

const MARGIN = STORY.margin;
/** 카드 바깥 모서리 둥글기(px). 모서리 바깥은 투명하게 저장된다. */
const CARD_RADIUS = 56;

type Side = "story" | "photo";
type Status = "loading" | "ready" | "error";

const fontOf = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // 캔버스가 오염되면(교차 출처) PNG로 저장할 수 없으므로 CORS 허용 요청으로 읽는다.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function setup(canvas: HTMLCanvasElement, background: string): CanvasRenderingContext2D | null {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // 바깥 모서리를 둥글게 자른다. 이후에 그리는 것은 모두 이 안쪽에만 보인다(저장하는 PNG의 모서리는 투명).
  roundedRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  ctx.clip();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.textBaseline = "middle";
  return ctx;
}

/** 둥근 사각형 경로 (브라우저의 roundRect 지원에 기대지 않는다). */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const measureWith = (ctx: CanvasRenderingContext2D, font: string) => (text: string) => {
  ctx.font = font;
  return ctx.measureText(text).width;
};

function drawFooter(ctx: CanvasRenderingContext2D, t: CardTheme, family: string) {
  ctx.textBaseline = "middle";
  ctx.fillStyle = t.accent;
  ctx.beginPath();
  ctx.arc(MARGIN + 6, 1304, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.mute;
  ctx.font = fontOf(600, 24, family);
  ctx.textAlign = "left";
  ctx.fillText("Hello Archive jr", MARGIN + 24, 1304);
}

/**
 * 이야기 면: 브랜드·연월 → "○○의 10월 이야기" → 아이의 답(가장 크게) → 기록 날짜 → 작은 질문 → 하단 브랜드.
 * 기록 1개는 인용 카드, 2~4개는 구분선으로 나눈다. 글을 줄이지 않고 담을 수 있는 만큼 담고(shownCount),
 * 한 개도 안 들어갈 만큼 긴 글만 줄인다(truncated). 화면에 보이는 캔버스가 곧 저장·공유되는 이미지다.
 */
function drawStory(
  canvas: HTMLCanvasElement,
  model: MonthCardModel,
  family: string,
  t: CardTheme,
): { truncated: boolean; shownCount: number } {
  const none = { truncated: false, shownCount: 0 };
  const ctx = setup(canvas, t.background);
  if (!ctx) return none;

  const measureFor: MeasureFor = (kind, size) =>
    measureWith(ctx, fontOf(kind === "title" ? 700 : kind === "answer" ? 600 : 400, size, family));
  const header = layoutHeader(measureFor, cardTitle(model));
  const layout = layoutStory(measureFor, model.items, header.bodyTop);
  if (!layout) return none;

  // 작은 브랜드명(왼쪽)과 연도·월(오른쪽)
  ctx.fillStyle = t.mute;
  ctx.font = fontOf(600, 24, family);
  ctx.textAlign = "left";
  ctx.fillText("Hello Archive jr", MARGIN, 104);
  ctx.textAlign = "right";
  ctx.fillStyle = t.soft;
  ctx.font = fontOf(600, 30, family);
  ctx.fillText(`${model.yearLabel}년 ${model.monthLabel}`, CARD_WIDTH - MARGIN, 104);
  ctx.textAlign = "left";

  // 제목과 나이, 짧은 포인트 선
  ctx.fillStyle = t.ink;
  ctx.font = fontOf(700, header.titleSize, family);
  header.titleLines.forEach((line, index) =>
    ctx.fillText(line, MARGIN, header.titleTop + index * header.titleLineHeight + header.titleLineHeight / 2),
  );
  ctx.fillStyle = t.mute;
  ctx.font = fontOf(600, 28, family);
  ctx.fillText(model.ageLabel, MARGIN, header.ageY);
  ctx.fillStyle = t.accent;
  roundedRect(ctx, MARGIN, header.ruleY, 64, 6, 3);
  ctx.fill();

  const { scale, blocks } = layout;
  const single = blocks.length === 1;
  const textLeft = single ? MARGIN + STORY.quoteIndent : MARGIN;
  const dateFont = fontOf(600, 26, family);

  blocks.forEach((block) => {
    let y = block.top;
    // 기록이 1개면 답 옆에 짧은 인용 막대를 세운다
    if (single) {
      ctx.fillStyle = t.accent;
      roundedRect(ctx, MARGIN, y + 8, 6, Math.min(block.answer.length * scale.answerLineHeight - 16, 120), 3);
      ctx.fill();
    }
    ctx.fillStyle = t.ink;
    ctx.font = fontOf(600, scale.answerSize, family);
    for (const line of block.answer) {
      ctx.fillText(line, textLeft, y + scale.answerLineHeight / 2);
      y += scale.answerLineHeight;
    }
    y += STORY.answerGap;

    // 기록 날짜 (작은 점 + 날짜)
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.arc(textLeft + 5, y + STORY.dateLineHeight / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.mute;
    ctx.font = dateFont;
    ctx.fillText(block.dateLabel, textLeft + 22, y + STORY.dateLineHeight / 2);
    y += STORY.dateLineHeight + STORY.dateGap;

    // 질문은 작고 차분하게
    ctx.fillStyle = t.soft;
    ctx.font = fontOf(400, scale.questionSize, family);
    for (const line of block.question) {
      ctx.fillText(line, textLeft, y + scale.questionLineHeight / 2);
      y += scale.questionLineHeight;
    }

    if (block.dividerY !== undefined) {
      ctx.fillStyle = t.line;
      ctx.fillRect(MARGIN, block.dividerY - 1, CARD_WIDTH - MARGIN * 2, 2);
    }
  });

  drawFooter(ctx, t, family);
  return { truncated: layout.truncated, shownCount: layout.shownCount };
}

/** 사진 면: 옅은 바탕에 사진을 넉넉하게, 아래에 날짜만 작게. 사진에 대한 글은 만들어 넣지 않는다. */
function drawPhoto(
  canvas: HTMLCanvasElement,
  model: MonthCardModel,
  family: string,
  photo: HTMLImageElement,
  dateLabel: string,
  t: CardTheme,
) {
  const ctx = setup(canvas, t.photoBackground);
  if (!ctx) return;

  // 사진은 틀을 꽉 채우도록 잘라 넣는다(얼굴이 보통 위쪽이라 위를 조금 더 남긴다).
  const frame = { x: 64, y: 64, w: CARD_WIDTH - 128, h: 1060 };
  const scale = Math.max(frame.w / photo.width, frame.h / photo.height);
  const sw = frame.w / scale;
  const sh = frame.h / scale;
  ctx.save();
  roundedRect(ctx, frame.x, frame.y, frame.w, frame.h, 32);
  ctx.clip();
  ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) * 0.35, sw, sh, frame.x, frame.y, frame.w, frame.h);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = t.accent;
  ctx.beginPath();
  ctx.arc(frame.x + 8, 1184, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.soft;
  ctx.font = fontOf(600, 30, family);
  ctx.fillText(dateLabel, frame.x + 28, 1184);
  const [label] = wrapText(
    measureWith(ctx, fontOf(600, 26, family)),
    `${model.yearLabel}년 ${model.monthLabel}`,
    360,
    1,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = t.mute;
  ctx.font = fontOf(600, 26, family);
  ctx.fillText(label ?? "", CARD_WIDTH - frame.x, 1184);
  ctx.textAlign = "left";

  ctx.textBaseline = "middle";
  ctx.fillStyle = t.accent;
  ctx.beginPath();
  ctx.arc(frame.x + 8, 1304, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.mute;
  ctx.font = fontOf(600, 24, family);
  ctx.fillText("Hello Archive jr", frame.x + 28, 1304);
}

function allText(model: MonthCardModel): string {
  return [
    cardTitle(model),
    model.yearLabel,
    model.monthLabel,
    model.ageLabel,
    model.photo?.dateLabel ?? "",
    ...model.items.flatMap((item) => [item.dateLabel, item.question, item.answer]),
    "Hello Archive jr 년 월 일 이야기 · … 0123456789/",
  ].join(" ");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const SIDE_LABEL: Record<Side, string> = { story: "이야기 면", photo: "사진 면" };

// 파일 공유를 지원하는 기기(주로 휴대폰)에서만 공유 버튼을 보인다. 서버 렌더링에서는 false로 시작한다.
const subscribeNothing = () => () => {};
function supportsFileShare(): boolean {
  const probe = new File([""], "probe.png", { type: "image/png" });
  return typeof navigator.share === "function" && navigator.canShare?.({ files: [probe] }) === true;
}

export function MonthCard({
  model,
  fileBase,
  fullHref,
}: {
  model: MonthCardModel;
  fileBase: string;
  /** 이 달의 전체 기록 화면. 카드에 다 담기지 않은 내용을 볼 수 있는 곳 */
  fullHref: string;
}) {
  const probeRef = useRef<HTMLSpanElement>(null);
  const canvases = useRef<Record<Side, HTMLCanvasElement | null>>({ story: null, photo: null });
  const [side, setSide] = useState<Side>("story");
  const [status, setStatus] = useState<Status>("loading");
  const [notice, setNotice] = useState("");
  const canShare = useSyncExternalStore(subscribeNothing, supportsFileShare, () => false);
  const [busy, setBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  // 사진 면은 사진이 실제로 그려졌을 때만 있다. 사진이 없거나 못 불러오면 이야기 면만 저장·공유한다.
  const [hasPhotoFace, setHasPhotoFace] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [shownCount, setShownCount] = useState(model.items.length);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const family = probeRef.current ? getComputedStyle(probeRef.current).fontFamily : "serif";
      // 한글 글꼴은 글자 조각 단위로 내려받으므로, 그릴 글자를 먼저 불러 둔다.
      const text = allText(model);
      try {
        await Promise.all([400, 600, 700].map((weight) => document.fonts.load(`${weight} 40px ${family}`, text)));
      } catch {
        // 글꼴을 못 불러오면 대체 글꼴로 그린다.
      }
      let photo: HTMLImageElement | null = null;
      if (model.photo) {
        try {
          photo = await loadImage(model.photo.url);
        } catch {
          if (!cancelled) setPhotoFailed(true);
        }
      }
      if (cancelled) return;
      const { story, photo: photoCanvas } = canvases.current;
      if (!story) return;
      const theme = CARD_THEMES[seasonOfMonth(model.month)];
      const drawn = drawStory(story, model, family, theme);
      if (photo && model.photo && photoCanvas) drawPhoto(photoCanvas, model, family, photo, model.photo.dateLabel, theme);
      setHasPhotoFace(Boolean(photo && model.photo && photoCanvas));
      setTruncated(drawn.truncated);
      setShownCount(drawn.shownCount);
      setStatus("ready");
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [model]);

  // 사진 면이 없으면 이야기 면을 보여 준다.
  const activeSide: Side = hasPhotoFace ? side : "story";
  const faces: Side[] = hasPhotoFace ? ["story", "photo"] : ["story"];

  async function blobOf(target: Side): Promise<Blob> {
    const canvas = canvases.current[target];
    if (!canvas) throw new Error("canvas");
    return toPng(canvas);
  }

  async function save(target: Side) {
    setBusy(true);
    setNotice("");
    try {
      download(await blobOf(target), `${fileBase}-${target}.png`);
      setNotice(`${SIDE_LABEL[target]}을 저장했어요. 다운로드(사진) 폴더를 확인해 주세요.`);
    } catch {
      setNotice("이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setNotice("");
    try {
      const files = await Promise.all(
        faces.map(async (target) => new File([await blobOf(target)], `${fileBase}-${target}.png`, { type: "image/png" })),
      );
      if (!navigator.canShare?.({ files })) {
        setNotice("이 기기에서는 바로 공유할 수 없어요. 이미지를 저장한 뒤 메신저나 SNS에서 보내 주세요.");
        return;
      }
      await navigator.share({ files, title: `${model.yearLabel}년 ${model.monthLabel} 이야기 카드` });
    } catch (error) {
      // 공유창을 닫은 것(AbortError)은 오류가 아니다.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setNotice("공유하지 못했어요. 저장한 뒤 다시 공유해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  const ready = status === "ready";
  const storyLabel = `${model.yearLabel}년 ${model.monthLabel} 이야기 카드 이야기 면. 기록 ${shownCount}개의 답과 질문`;
  const photoLabel = `${model.yearLabel}년 ${model.monthLabel} 이야기 카드 사진 면. ${model.photo?.dateLabel ?? ""} 사진`;
  const omittedCount = model.entryCount - shownCount;

  return (
    <div className="flex flex-col gap-5">
      {/* 카드 글꼴(명조)을 읽어 오기 위한 보이지 않는 요소 */}
      <span ref={probeRef} aria-hidden className="font-serif invisible absolute" />

      {faces.length > 1 && (
        <div role="group" aria-label="카드 면 고르기" className="grid grid-cols-2 overflow-hidden rounded-xl border border-ink">
          {faces.map((target) => (
            <button
              key={target}
              type="button"
              aria-pressed={activeSide === target}
              onClick={() => setSide(target)}
              className={`min-h-12 font-semibold ${
                activeSide === target ? "bg-ink text-paper" : "hover:bg-blush"
              } ${target === "photo" ? "border-l border-ink" : ""}`}
            >
              {SIDE_LABEL[target]}
            </button>
          ))}
        </div>
      )}

      <div className="relative mx-auto w-full max-w-sm">
        {!ready && (
          <div
            role="status"
            className={`grid aspect-[4/5] w-full place-items-center rounded-3xl border text-sm ${
              status === "error" ? "border-brand text-brand-deep" : "animate-pulse border-line bg-paper-deep text-ink-soft"
            }`}
          >
            {status === "error" ? "카드를 만들지 못했어요. 새로고침해 주세요." : "카드를 만드는 중…"}
          </div>
        )}
        {/* 캔버스는 숨겨 둔 면까지 모두 그려 두어야 공유·저장이 된다 */}
        <canvas
          ref={(node) => {
            canvases.current.story = node;
          }}
          role="img"
          aria-label={storyLabel}
          className={`aspect-[4/5] h-auto w-full [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.14))] ${ready && activeSide === "story" ? "block" : "hidden"}`}
        />
        {model.photo && (
          <canvas
            ref={(node) => {
              canvases.current.photo = node;
            }}
            role="img"
            aria-label={photoLabel}
            className={`aspect-[4/5] h-auto w-full [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.14))] ${ready && activeSide === "photo" ? "block" : "hidden"}`}
          />
        )}
      </div>

      {photoFailed && (
        <p className="text-sm text-ink-soft">사진을 불러오지 못해 이야기 면만 보여 드려요.</p>
      )}
      {ready && !model.photo && (
        <p className="text-sm text-ink-soft">이 달에는 올린 사진이 없어 이야기 면만 만들었어요.</p>
      )}

      {ready && (truncated || omittedCount > 0) && (
        <p role="note" className="rounded-xl bg-paper-deep/60 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
          {omittedCount > 0 && `이 달의 기록 ${model.entryCount}개 중 최근 ${shownCount}개가 카드에 담겼어요. `}
          {truncated && "긴 글은 카드에서 줄여서 보여요. "}
          <Link href={fullHref} className="font-semibold underline underline-offset-4 hover:text-brand">
            이 달의 전체 기록 보기
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="rounded-xl bg-paper-deep/60 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          공유하거나 저장한 이미지에는 아이 별명({model.childName})·나이와 카드에 보이는 질문·답이 그대로 담기고, 사진 면에는 이 달의 사진이 들어갈 수 있어요.
          이미지를 받은 사람은 누구나 볼 수 있으니 확인한 뒤에 공유해 주세요.
        </p>
        {!canShare && (
          <p className="text-[12px] leading-relaxed text-ink-soft">
            이 기기에서는 바로 공유가 지원되지 않아요. 아래에서 이미지를 저장해 보내 주세요.
          </p>
        )}
        {canShare && (
          <button
            type="button"
            onClick={share}
            disabled={!ready || busy}
            className="flex min-h-12 w-full items-center justify-between rounded-xl bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {faces.length > 1 ? "이야기 면·사진 면 함께 공유하기" : "이야기 면 공유하기"}
            <span aria-hidden>↗</span>
          </button>
        )}
        <div className={`grid gap-2 ${faces.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {faces.map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => save(target)}
              disabled={!ready || busy}
              className="min-h-12 rounded-xl border border-ink px-3 font-semibold hover:bg-ink hover:text-paper disabled:opacity-60"
            >
              {SIDE_LABEL[target]} 이미지 저장
            </button>
          ))}
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-soft">
          {notice}
        </p>
      </div>
    </div>
  );
}
