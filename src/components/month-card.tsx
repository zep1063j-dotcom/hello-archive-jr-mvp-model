"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ALBUM, ALBUM_WIDTH, CARD_HEIGHT, CARD_WIDTH, albumFrames, albumGroups,
  cardTitle, layoutAlbumHeader, layoutAlbumStories, seasonOfMonth,
  type AlbumStoryBlock, type MeasureFor, type MonthCardItem, type MonthCardModel,
} from "@/lib/month-card";
import { CARD_THEMES, type CardTheme } from "@/lib/month-card-theme";

// 앞면은 날짜·사진 앨범, 뒷면은 질문·답 목록. 미리보기 캔버스를 그대로 저장한다.
// 사진과 생성 이미지는 기기 안에서만 처리한다. 외곽과 사진 틀에는 둥근 모서리를 쓰지 않는다.
type AlbumPage = { canvas: HTMLCanvasElement; label: string; filename: string; description: string };
type Status = "loading" | "ready" | "error";
const fontOf = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;
const subscribeNothing = () => () => {};

function supportsFileShare(): boolean {
  const probe = new File([""], "probe.png", { type: "image/png" });
  return typeof navigator.share === "function" && navigator.canShare?.({ files: [probe] }) === true;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => { image.src = ""; reject(new Error("image-timeout")); }, 15000);
    image.crossOrigin = "anonymous";
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error("image")); };
    image.src = url;
  });
}

function createCanvas(background: string) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  // 바깥 모서리까지 불투명한 직각 이미지로 저장한다.
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.textBaseline = "top";
  return { canvas, ctx };
}

function drawFront(items: MonthCardItem[], photos: Map<string, HTMLImageElement>, family: string, theme: CardTheme) {
  const { canvas, ctx } = createCanvas(theme.photoBackground);
  albumFrames(items.length).forEach((frame, index) => {
    const item = items[index];
    const photo = item.photoUrl ? photos.get(item.photoUrl) : undefined;
    const photoHeight = frame.height - 64;
    ctx.fillStyle = theme.background;
    ctx.fillRect(frame.x, frame.y, frame.width, photoHeight);
    if (photo) {
      const scale = Math.max(frame.width / photo.width, photoHeight / photo.height);
      const sw = frame.width / scale;
      const sh = photoHeight / scale;
      ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) * 0.35, sw, sh, frame.x, frame.y, frame.width, photoHeight);
    }
    ctx.fillStyle = theme.ink;
    ctx.font = fontOf(400, 26, family);
    ctx.fillText(item.dateLabel, frame.x + 4, frame.y + photoHeight + 18);
  });
  return canvas;
}

function drawBack(model: MonthCardModel, blocks: AlbumStoryBlock[], family: string, theme: CardTheme, pageNumber: number, total: number) {
  const { canvas, ctx } = createCanvas(theme.photoBackground);
  const measureFor: MeasureFor = (kind, size) => (text) => {
    ctx.font = fontOf(kind === "title" ? 700 : kind === "answer" ? 600 : 400, size, family);
    return ctx.measureText(text).width;
  };
  const header = layoutAlbumHeader(measureFor, cardTitle(model));
  ctx.fillStyle = theme.soft;
  ctx.font = fontOf(400, 25, family);
  ctx.fillText(`${model.yearLabel}년 ${model.monthLabel}`, ALBUM.margin, 58);
  ctx.textAlign = "right";
  ctx.fillText(model.ageLabel, CARD_WIDTH - ALBUM.margin, 58);
  ctx.textAlign = "left";
  ctx.fillStyle = theme.ink;
  ctx.font = fontOf(700, header.titleSize, family);
  header.titleLines.forEach((line, i) => ctx.fillText(line, ALBUM.margin, 112 + i * 60));
  ctx.fillStyle = theme.line;
  ctx.fillRect(ALBUM.margin, header.bodyTop - 32, ALBUM_WIDTH, 1);
  blocks.forEach((block, index) => {
    let y = block.top;
    ctx.fillStyle = theme.soft;
    ctx.font = fontOf(400, 25, family);
    ctx.fillText(`${block.dateLabel}${block.continued ? " · 계속" : ""}`, ALBUM.margin, y);
    y += ALBUM.dateLineHeight + ALBUM.dateGap;
    ctx.fillStyle = theme.soft;
    ctx.font = fontOf(400, ALBUM.questionSize, family);
    block.question.forEach((line) => { ctx.fillText(line, ALBUM.margin, y); y += ALBUM.questionLineHeight; });
    if (block.question.length) y += ALBUM.answerGap;
    ctx.fillStyle = theme.ink;
    ctx.font = fontOf(600, ALBUM.answerSize, family);
    block.answer.forEach((line) => { ctx.fillText(line, ALBUM.margin, y); y += ALBUM.answerLineHeight; });
    if (index < blocks.length - 1) {
      ctx.fillStyle = theme.line;
      ctx.fillRect(ALBUM.margin, block.bottom + ALBUM.blockGap / 2, ALBUM_WIDTH, 1);
    }
  });
  ctx.fillStyle = theme.mute;
  ctx.font = fontOf(400, 23, family);
  ctx.fillText("Hello Archive jr", ALBUM.margin, 1284);
  ctx.textAlign = "right";
  ctx.fillText(`${pageNumber} / ${total}`, CARD_WIDTH - ALBUM.margin, 1284);
  return canvas;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try { canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("blob")), "image/png"); }
    catch (error) { reject(error); }
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function MonthCard({ model, fileBase, fullHref }: { model: MonthCardModel; fileBase: string; fullHref: string }) {
  const probeRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState<{ model: MonthCardModel; pages: AlbumPage[]; failed: number } | null>(null);
  const [failure, setFailure] = useState<MonthCardModel | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const canShare = useSyncExternalStore(subscribeNothing, supportsFileShare, () => false);
  const status: Status = failure === model ? "error" : rendered?.model === model ? "ready" : "loading";
  const pages = rendered?.model === model ? rendered.pages : [];
  const activeIndex = Math.min(selected, Math.max(0, pages.length - 1));
  const active = pages[activeIndex];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const family = probeRef.current ? getComputedStyle(probeRef.current).fontFamily : "serif";
      const text = [cardTitle(model), model.ageLabel, model.yearLabel, ...model.items.flatMap((item) => [item.dateLabel, item.question, item.answer]), "Hello Archive jr 계속 년 월 일 0123456789/·"].join(" ");
      try { await Promise.all([400, 600, 700].map((weight) => document.fonts.load(fontOf(weight, 36, family), text))); }
      catch { /* 글꼴을 못 읽으면 기기의 대체 글꼴을 쓴다. */ }
      const urls = [...new Set(model.items.flatMap((item) => item.photoUrl ? [item.photoUrl] : []))];
      const loaded = await Promise.allSettled(urls.map(loadImage));
      if (cancelled) return;
      const photos = new Map<string, HTMLImageElement>();
      loaded.forEach((result, i) => { if (result.status === "fulfilled") photos.set(urls[i], result.value); });
      const theme = CARD_THEMES[seasonOfMonth(model.month)];
      const measureCanvas = createCanvas(theme.photoBackground);
      const measureFor: MeasureFor = (kind, size) => (value) => {
        measureCanvas.ctx.font = fontOf(kind === "title" ? 700 : kind === "answer" ? 600 : 400, size, family);
        return measureCanvas.ctx.measureText(value).width;
      };
      const header = layoutAlbumHeader(measureFor, cardTitle(model));
      const groups = albumGroups(model.items);
      const result: AlbumPage[] = [];
      groups.forEach((items, groupIndex) => {
        const prefix = groups.length > 1 ? `${groupIndex + 1}묶음 · ` : "";
        const stem = `${fileBase}-${String(groupIndex + 1).padStart(2, "0")}`;
        result.push({ canvas: drawFront(items, photos, family, theme), label: `${prefix}앞면 · 사진`, filename: `${stem}-front.png`, description: `앞면. ${items.map((item) => item.dateLabel).join(", ")}의 사진. 사진 없는 칸은 날짜만 표시` });
        const backs = layoutAlbumStories(measureFor, items, header.bodyTop);
        backs.forEach((blocks, index) => result.push({
          canvas: drawBack(model, blocks, family, theme, index + 1, backs.length),
          label: `${prefix}뒷면 · 대화${backs.length > 1 ? ` ${index + 1}` : ""}`,
          filename: `${stem}-back-${String(index + 1).padStart(2, "0")}.png`,
          description: `뒷면 ${index + 1}. ${blocks.map((block) => `${block.dateLabel}${block.continued ? " 계속" : ""}. ${block.question.join(" ")} ${block.answer.join(" ")}`).join(". ")}`,
        }));
      });
      if (!cancelled) setRendered({ model, pages: result, failed: urls.length - photos.size });
    })().catch(() => { if (!cancelled) setFailure(model); });
    return () => { cancelled = true; };
  }, [model, fileBase]);

  useEffect(() => {
    if (!active || !previewRef.current) return;
    const canvas = previewRef.current;
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    canvas.getContext("2d")?.drawImage(active.canvas, 0, 0);
  }, [active]);

  async function save() {
    if (!active || busy) return;
    setBusy(true);
    setNotice("");
    try { download(await toPng(active.canvas), active.filename); setNotice(`${active.label}을 저장했어요.`); }
    catch { setNotice("이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  async function share() {
    if (!pages.length || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const files = await Promise.all(pages.map(async (page) => new File([await toPng(page.canvas)], page.filename, { type: "image/png" })));
      if (!navigator.canShare?.({ files })) { setNotice("이 카드 묶음은 바로 공유할 수 없어요. 각 이미지를 저장해 보내 주세요."); return; }
      await navigator.share({ files, title: cardTitle(model) });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("공유하지 못했어요. 이미지를 저장한 뒤 보내 주세요.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      <span ref={probeRef} aria-hidden className="font-serif invisible absolute" />
      <p className="text-sm leading-relaxed text-ink-soft">앞면에는 날짜와 사진, 뒷면에는 같은 순서의 질문과 답이 담겨요. 사진이 없는 칸에는 날짜만 남겨요.</p>
      {pages.length > 0 && (
        <div role="group" aria-label="카드 면 고르기" className="flex flex-wrap gap-2">
          {pages.map((page, index) => <button key={page.filename} type="button" aria-pressed={activeIndex === index} onClick={() => setSelected(index)}
            className={`min-h-11 border border-ink px-4 text-sm ${activeIndex === index ? "bg-ink text-paper" : "hover:bg-blush"}`}>{page.label}</button>)}
        </div>
      )}
      <div className="mx-auto w-full max-w-sm">
        {status !== "ready" && <div role="status" className={`grid aspect-[4/5] place-items-center border text-sm ${status === "error" ? "border-brand text-brand-deep" : "animate-pulse border-line bg-paper-deep text-ink-soft"}`}>
          {status === "error" ? "카드를 만들지 못했어요. 새로고침해 주세요." : "앨범을 만드는 중…"}
        </div>}
        <canvas ref={previewRef} role="img" aria-label={active ? `${cardTitle(model)}. ${active.description}` : "한 달 이야기 카드"}
          className={`aspect-[4/5] h-auto w-full shadow-[0_3px_18px_rgb(0_0_0/0.12)] ${status === "ready" ? "block" : "hidden"}`} />
      </div>
      {status === "ready" && (
        <div className="text-[13px] leading-relaxed text-ink-soft">
          <p>기록 {model.entryCount}개를 모두 담았어요. 긴 대화는 다음 뒷면으로 이어져요.</p>
          {rendered && rendered.failed > 0 && <p role="status">사진 {rendered.failed}장을 불러오지 못해 해당 칸에는 날짜만 표시했어요. 새로고침하면 다시 불러와요.</p>}
          <Link href={fullHref} className="underline underline-offset-4">이 달의 전체 기록 보기</Link>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="bg-paper-deep/60 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">저장·공유한 이미지에는 아이 별명·나이·사진과 질문·답변이 담겨요. 이미지를 받은 사람은 누구나 볼 수 있으니 공유 전에 확인해 주세요.</p>
        {canShare && <button type="button" onClick={share} disabled={status !== "ready" || busy} className="min-h-12 bg-brand px-5 font-semibold text-white hover:bg-brand-deep disabled:opacity-60">앞면·뒷면 함께 공유하기{pages.length > 0 ? ` (${pages.length}장)` : ""}</button>}
        <button type="button" onClick={save} disabled={status !== "ready" || busy} className="min-h-12 border border-ink px-3 font-semibold hover:bg-ink hover:text-paper disabled:opacity-60">{busy ? "준비하고 있어요…" : `${active?.label ?? "선택한 면"} 이미지 저장`}</button>
        {!canShare && <p className="text-[12px] text-ink-soft">각 면을 선택해 이미지를 저장한 뒤 메신저나 SNS에서 보내 주세요.</p>}
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-soft">{notice}</p>
      </div>
    </div>
  );
}
