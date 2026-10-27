"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FRONT,
  FRONT_CONTENT_WIDTH,
  layoutFront,
  wrapText,
  type MonthCardModel,
} from "@/lib/month-card";

// 1개월 이야기 카드 (D-029). 캔버스에 그려서 화면에 보여 주고, 같은 캔버스를 PNG로 저장·공유한다
// (보이는 것과 저장되는 것이 같다). 카드는 부모의 기기 안에서만 만들어지고 서버로 올라가지 않는다.

const PAPER = "#f7f3eb";
const BLUSH = "#f6e5da";
const INK = "#111111";
const INK_SOFT = "#57534e";
const INK_MUTE = "#7d766b";
const BRAND = "#d92f3e";
const LINE = "#d6cdbb";
const MARGIN = FRONT.margin;

type Side = "front" | "back";
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
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.textBaseline = "middle";
  return ctx;
}

function drawFooter(ctx: CanvasRenderingContext2D, family: string, right: string) {
  ctx.fillStyle = LINE;
  ctx.fillRect(MARGIN, 1262, CARD_WIDTH - MARGIN * 2, 2);
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.arc(MARGIN + 6, 1304, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK_MUTE;
  ctx.font = fontOf(600, 24, family);
  ctx.textAlign = "left";
  ctx.fillText("Hello Archive jr", MARGIN + 24, 1304);
  ctx.textAlign = "right";
  ctx.fillText(right, CARD_WIDTH - MARGIN, 1304);
  ctx.textAlign = "left";
}

function drawFront(canvas: HTMLCanvasElement, model: MonthCardModel, family: string) {
  const ctx = setup(canvas, PAPER);
  if (!ctx) return;
  const measure = (font: string) => (text: string) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };

  ctx.textAlign = "right";
  ctx.fillStyle = INK_MUTE;
  ctx.font = fontOf(600, 30, family);
  ctx.fillText(model.yearLabel, CARD_WIDTH - MARGIN, 122);
  ctx.textAlign = "left";

  ctx.fillStyle = INK;
  ctx.font = fontOf(700, 150, family);
  ctx.fillText(model.monthLabel, MARGIN, 196);

  const who = [model.childName, model.ageLabel].filter(Boolean).join(" · ");
  const [whoLine] = wrapText(measure(fontOf(600, 34, family)), who, FRONT_CONTENT_WIDTH, 1);
  ctx.fillStyle = INK_SOFT;
  ctx.font = fontOf(600, 34, family);
  ctx.fillText(whoLine ?? "", MARGIN, 292);

  ctx.fillStyle = INK;
  ctx.fillRect(MARGIN, 330, CARD_WIDTH - MARGIN * 2, 3);

  const questionFont = fontOf(600, FRONT.questionSize, family);
  const answerFont = fontOf(400, FRONT.answerSize, family);
  const blocks = layoutFront(measure(questionFont), measure(answerFont), model.items);
  blocks.forEach((block, index) => {
    let y = block.top;
    ctx.fillStyle = BRAND;
    ctx.font = questionFont;
    for (const line of block.question) {
      ctx.fillText(line, MARGIN, y + FRONT.questionLineHeight / 2);
      y += FRONT.questionLineHeight;
    }
    y += FRONT.questionGap;
    ctx.fillStyle = INK;
    ctx.font = answerFont;
    for (const line of block.answer) {
      ctx.fillText(line, MARGIN, y + FRONT.answerLineHeight / 2);
      y += FRONT.answerLineHeight;
    }
    const next = blocks[index + 1];
    if (next) {
      ctx.fillStyle = LINE;
      ctx.fillRect(MARGIN, (y + next.top) / 2 - 1, CARD_WIDTH - MARGIN * 2, 2);
    }
  });

  drawFooter(ctx, family, `이달의 기록 ${model.entryCount}개`);
}

function drawBack(
  canvas: HTMLCanvasElement,
  model: MonthCardModel,
  family: string,
  photo: HTMLImageElement | null,
) {
  const caption = `${model.yearLabel}년 ${model.monthLabel}`;

  if (photo) {
    const ctx = setup(canvas, PAPER);
    if (!ctx) return;
    // 사진은 틀을 꽉 채우도록 잘라 넣는다(얼굴이 보통 위쪽이라 위를 조금 더 남긴다).
    const frame = { x: MARGIN, y: 88, w: CARD_WIDTH - MARGIN * 2, h: 1010 };
    const scale = Math.max(frame.w / photo.width, frame.h / photo.height);
    const sw = frame.w / scale;
    const sh = frame.h / scale;
    ctx.drawImage(
      photo,
      (photo.width - sw) / 2,
      (photo.height - sh) * 0.35,
      sw,
      sh,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
    );
    ctx.fillStyle = INK;
    ctx.font = fontOf(700, 56, family);
    ctx.fillText(caption, MARGIN, 1154);
    ctx.fillStyle = INK_SOFT;
    ctx.font = fontOf(600, 34, family);
    const measure = (text: string) => ctx.measureText(text).width;
    const [name] = wrapText(measure, `${model.childName}의 한 달`, FRONT_CONTENT_WIDTH, 1);
    ctx.fillText(name ?? "", MARGIN, 1214);
    drawFooter(ctx, family, "");
    return;
  }

  const ctx = setup(canvas, BLUSH);
  if (!ctx) return;
  ctx.fillStyle = BRAND;
  ctx.font = fontOf(700, 220, family);
  ctx.textAlign = "center";
  ctx.fillText("“", CARD_WIDTH / 2, 330);

  const quoteFont = fontOf(600, 60, family);
  ctx.font = quoteFont;
  const lines = wrapText((text) => ctx.measureText(text).width, model.quote, 800, 6);
  const lineHeight = 100;
  const startY = 700 - ((lines.length - 1) * lineHeight) / 2;
  ctx.fillStyle = INK;
  ctx.font = quoteFont;
  lines.forEach((line, index) => ctx.fillText(line, CARD_WIDTH / 2, startY + index * lineHeight));

  ctx.fillStyle = INK;
  ctx.fillRect(CARD_WIDTH / 2 - 40, 1030, 80, 3);
  ctx.fillStyle = INK_SOFT;
  ctx.font = fontOf(600, 34, family);
  const [label] = wrapText(
    (text) => ctx.measureText(text).width,
    `${caption} · ${model.childName}`,
    FRONT_CONTENT_WIDTH,
    1,
  );
  ctx.fillText(label ?? caption, CARD_WIDTH / 2, 1100);
  ctx.textAlign = "left";
  drawFooter(ctx, family, "");
}

function allText(model: MonthCardModel): string {
  return [
    model.yearLabel,
    model.monthLabel,
    model.childName,
    model.ageLabel,
    model.quote,
    ...model.items.flatMap((item) => [item.question, item.answer]),
    "Hello Archive jr 이달의 기록 개의 한 달 년 “ · … 0123456789",
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

const SIDE_LABEL: Record<Side, string> = { front: "앞면", back: "뒷면" };

// 파일 공유를 지원하는 기기(주로 휴대폰)에서만 공유 버튼을 보인다. 서버 렌더링에서는 false로 시작한다.
const subscribeNothing = () => () => {};
function supportsFileShare(): boolean {
  const probe = new File([""], "probe.png", { type: "image/png" });
  return typeof navigator.share === "function" && navigator.canShare?.({ files: [probe] }) === true;
}

export function MonthCard({ model, fileBase }: { model: MonthCardModel; fileBase: string }) {
  const probeRef = useRef<HTMLSpanElement>(null);
  const canvases = useRef<Record<Side, HTMLCanvasElement | null>>({ front: null, back: null });
  const [side, setSide] = useState<Side>("front");
  const [status, setStatus] = useState<Status>("loading");
  const [notice, setNotice] = useState("");
  const canShare = useSyncExternalStore(subscribeNothing, supportsFileShare, () => false);
  const [busy, setBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

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
      if (model.back.kind === "photo") {
        try {
          photo = await loadImage(model.back.url);
        } catch {
          if (!cancelled) setPhotoFailed(true);
        }
      }
      if (cancelled) return;
      const { front, back } = canvases.current;
      if (!front || !back) return;
      drawFront(front, model, family);
      drawBack(back, model, family, photo);
      setStatus("ready");
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [model]);

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
        (["front", "back"] as const).map(
          async (target) => new File([await blobOf(target)], `${fileBase}-${target}.png`, { type: "image/png" }),
        ),
      );
      if (!navigator.canShare?.({ files })) {
        setNotice("이 기기에서는 공유할 수 없어요. 앞면·뒷면을 각각 저장해 주세요.");
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
  const frontLabel = `${model.yearLabel}년 ${model.monthLabel} 이야기 카드 앞면. 질문과 답 ${model.items.length}개`;
  const backLabel =
    model.back.kind === "photo" && !photoFailed
      ? `${model.yearLabel}년 ${model.monthLabel} 이야기 카드 뒷면. 이달의 사진`
      : `${model.yearLabel}년 ${model.monthLabel} 이야기 카드 뒷면. 글귀: ${model.quote}`;

  return (
    <div className="flex flex-col gap-5">
      {/* 카드 글꼴(명조)을 읽어 오기 위한 보이지 않는 요소 */}
      <span ref={probeRef} aria-hidden className="font-serif invisible absolute" />

      <div role="group" aria-label="카드 면 고르기" className="grid grid-cols-2 border border-ink">
        {(["front", "back"] as const).map((target) => (
          <button
            key={target}
            type="button"
            aria-pressed={side === target}
            onClick={() => setSide(target)}
            className={`min-h-12 font-semibold ${
              side === target ? "bg-ink text-paper" : "hover:bg-blush"
            } ${target === "back" ? "border-l border-ink" : ""}`}
          >
            {SIDE_LABEL[target]}
          </button>
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        {!ready && (
          <div
            role="status"
            className={`grid aspect-[4/5] w-full place-items-center border text-sm ${
              status === "error" ? "border-brand text-brand-deep" : "animate-pulse border-line bg-paper-deep text-ink-soft"
            }`}
          >
            {status === "error" ? "카드를 만들지 못했어요. 새로고침해 주세요." : "카드를 만드는 중…"}
          </div>
        )}
        {/* 캔버스는 숨겨 둔 면까지 모두 그려 두어야 공유·저장이 된다 */}
        <canvas
          ref={(node) => {
            canvases.current.front = node;
          }}
          role="img"
          aria-label={frontLabel}
          className={`aspect-[4/5] h-auto w-full border border-line ${ready && side === "front" ? "block" : "hidden"}`}
        />
        <canvas
          ref={(node) => {
            canvases.current.back = node;
          }}
          role="img"
          aria-label={backLabel}
          className={`aspect-[4/5] h-auto w-full border border-line ${ready && side === "back" ? "block" : "hidden"}`}
        />
      </div>

      {photoFailed && (
        <p className="text-sm text-ink-soft">사진을 불러오지 못해 글귀로 보여 드려요.</p>
      )}

      <div className="flex flex-col gap-2">
        {canShare && (
          <button
            type="button"
            onClick={share}
            disabled={!ready || busy}
            className="flex min-h-12 w-full items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            앞면·뒷면 함께 공유하기
            <span aria-hidden>↗</span>
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {(["front", "back"] as const).map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => save(target)}
              disabled={!ready || busy}
              className="min-h-12 border border-ink px-3 font-semibold hover:bg-ink hover:text-paper disabled:opacity-60"
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
