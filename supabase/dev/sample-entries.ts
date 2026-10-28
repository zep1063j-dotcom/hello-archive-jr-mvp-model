// 카드·아카이브 화면 확인용 샘플 기록 만들기/지우기 (개발용 Supabase 프로젝트에서만 실행한다).
//   만들기: npm run sample:seed      지우기: npm run sample:clean
// 샘플 계정 1개(+ 아이 1명)를 새로 만들고, 2024-06 ~ 2026-10 사이에 기록 100개를 넣는다. 기존 사용자 계정·기록은 건드리지 않는다.
//  - 기록은 주에 하나(수요일 저녁)이고, 달마다 1~5개로 흩어 둔다(카드의 기록 1개/4개/5개 배치 확인용). 몇 달은 사진이 있다.
//  - 이 계정은 example.com 주소라 이메일 코드를 받을 수 없다. 확인용 로그인 정보는 git 제외 파일(.sample-account.local.json)에만 적는다.
//  - 지난 주 질문(weekly_questions)이 없는 주는 샘플용으로 새로 넣고, 지울 때 그 행만 지운다. 아이·기록·사진은 계정 삭제와 함께 지워진다.
// 이 스크립트는 개발용 프로젝트 전용이다. .env.local이 개발 DB를 가리킬 때만 실행한다(정식 DB에는 실행하지 않는다).
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요하다 (.env.local).");

const STATE_FILE = ".sample-account.local.json";
const SAMPLE_EMAIL = "sample-100-entries@example.com";
// 앱용 DB 타입은 부모 권한(컬럼 단위 GRANT) 기준이라 created_at 같은 열을 넣을 수 없다. 이 스크립트는 service role이라 타입 없이 쓴다.
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type State = { email: string; password: string; userId: string; questionIds: string[] };

// ---- 날짜 (KST 수요일 21:00에 쓴 것으로 한다) ----
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (key: string, days: number) => dateKey(new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000));
const mondayOf = (key: string) => addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));

/** 달(YYYY-MM)의 수요일들 */
function wednesdaysOf(month: string): string[] {
  const result: string[] = [];
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(`${month}-${pad(day)}T00:00:00Z`);
    if (date.getUTCMonth() + 1 !== Number(month.slice(5, 7))) break;
    if (date.getUTCDay() === 3) result.push(dateKey(date));
  }
  return result;
}

// 최근 달부터 거꾸로 달마다 넣을 기록 수. 수요일 수보다 많으면 그 달의 수요일 수까지만 넣고, 100개가 찰 때까지 더 이전 달로 이어 간다.
const WANTED_PER_MONTH = [4, 3, 4, 5, 4, 3, 5, 1, 4, 4, 5, 4, 3, 4, 2, 4, 3, 4, 1, 4, 3, 4, 3, 2, 4, 3, 4, 4];
const TOTAL = 100;

function planMonths(): { month: string; days: string[] }[] {
  const plan: { month: string; days: string[] }[] = [];
  let year = 2026;
  let monthNumber = 10;
  let total = 0;
  for (let i = 0; total < TOTAL; i += 1) {
    const month = `${year}-${pad(monthNumber)}`;
    const wanted = WANTED_PER_MONTH[i] ?? 4;
    const days = wednesdaysOf(month).slice(0, Math.min(wanted, TOTAL - total));
    plan.unshift({ month, days });
    total += days.length;
    monthNumber -= 1;
    if (monthNumber === 0) {
      monthNumber = 12;
      year -= 1;
    }
  }
  return plan;
}

// ---- 샘플 글 (아이의 말·일상. 실제 아이의 기록이 아니다) ----
const SENTENCES = [
  "공룡은 밤에 자는 거야? 그럼 코 골아?",
  "엄마, 나는 커서 소방차 아저씨가 될 거야. 불 끄고 고양이도 구해 줄 거야.",
  "달님이 자꾸 나를 따라와. 내가 걸으면 달님도 걸어.",
  "오늘은 비가 와서 하늘이 샤워하는 거래.",
  "할머니 집 강아지가 나한테 뽀뽀했어. 간지러워서 막 웃었어.",
  "내가 하나, 둘, 셋 세면 눈 감고 있어야 돼. 비밀이야.",
  "아빠 손은 크고 따뜻해서 내 손이 쏙 들어가.",
  "어린이집에서 친구랑 모래로 케이크를 만들었어. 생일 노래도 불렀어요.",
  "나는 초록색이 제일 좋아. 개구리도 초록이고 브로콜리도 초록이니까.",
  "엄마가 슬퍼 보여서 내가 안아 줬어. 이제 괜찮지?",
  "토마토는 빨간 공 같아. 근데 먹으면 새콤해.",
  "무지개는 누가 그렸어? 하늘나라 아저씨가 그렸나?",
  "자기 전에 책 세 권만 읽어 주세요. 진짜 세 권만요!",
  "나 오늘 혼자 신발 신었어요. 끈은 아직 못 묶지만 거의 다 했어요.",
  "별은 낮에는 어디 가서 쉬어요?",
  "동생이 울면 내가 노래해 줄게. 반짝반짝 작은 별.",
  "내가 없을 때 장난감들은 뭐 하고 놀아?",
  "바다에 가면 파도가 내 발을 간질간질해요. 파도도 나랑 놀고 싶은가 봐.",
  "엄마 사랑해. 하늘만큼 땅만큼, 그리고 우주만큼 사랑해.",
  "오늘 유치원에서 선생님이 칭찬해 줬어요. 내가 줄을 제일 잘 섰대요.",
  "눈사람이 녹으면 어디로 가요? 물이 되어서 하늘로 올라가요?",
  "내 그림자가 나보다 키가 커졌어. 저녁에는 더 커져!",
  "아빠, 나 이제 혼자서 샤워할 수 있어요. 대신 문은 열어 둬요.",
  "빵집 아저씨가 나한테 쿠키 하나를 더 줬어. 왜냐면 내가 인사를 잘해서.",
  "나는 겁쟁이 아니야. 어두운 것만 조금 무서운 거야.",
  "구름은 솜사탕인가 봐. 한 입 먹어 보고 싶다.",
  "엄마가 아프면 내가 약 먹여 줄게. 쓰면 내가 사탕 줄게.",
  "병아리가 내 손바닥에서 삐약삐약 했어요. 심장이 콩콩콩 뛰었어요.",
  "이건 비밀인데, 나 사실 하늘을 날 수 있어. 근데 아무도 안 볼 때만.",
  "오늘은 내 인형이 아파서 병원 놀이를 했어요. 내가 의사 선생님이에요.",
];

const LONG_EXTRA = [
  "그러고 나서 한참 생각하더니, 이렇게 말했다.",
  "그 말을 하고는 혼자 깔깔 웃었다.",
  "옆에 있던 동생도 따라서 웃었다.",
  "나는 그 순간을 오래 기억하고 싶어서 바로 휴대폰에 적어 두었다.",
  "잠들기 전에 한 번 더 이야기해 달라고 했다.",
  "다음 날 아침에도 똑같이 말해서 깜짝 놀랐다.",
];

const QUESTIONS = [
  "오늘 제일 좋았던 건 뭐야?",
  "요즘 제일 좋아하는 놀이는 뭐야?",
  "오늘 누구랑 놀았어?",
  "크면 뭐가 되고 싶어?",
  "무서운 게 있다면 뭐야?",
  "엄마 아빠에게 해 주고 싶은 말이 있어?",
  "오늘 먹은 것 중에 제일 맛있었던 건 뭐야?",
  "가장 좋아하는 색깔은 뭐고 왜 좋아?",
  "자기 전에 어떤 이야기를 듣고 싶어?",
  "오늘 웃었던 순간이 있다면 언제야?",
];

/** 눈에 띄게 다르게 만든 기록: 달 → 몇 번째 기록 → { 답, 질문 } */
const SPECIAL: Record<string, { answer?: string; question?: string }> = {
  // 가을(10월): 길이가 다른 네 개 + 이모지
  "2026-10:0": { answer: "오늘 처음으로 혼자서 계란후라이를 뒤집었어요! 🍳 \"엄마, 이거 봐요, 안 깨졌어!\" 하고 소리를 질렀다." },
  "2026-10:3": {
    answer:
      "산책하다가 은행잎이 노랗게 떨어지는 걸 보고 한참을 서 있었다.\n\"엄마, 나무가 노란 비를 내려요.\"\n그러더니 은행잎을 한 움큼 주워서 하늘로 던지며 \"노란 눈이다!\" 하고 웃었다. 집에 와서도 주머니에서 은행잎을 꺼내 책상 위에 줄 세워 놓았다. 내일 유치원에 가져가서 선생님께 보여 줄 거라고 했다.",
    question: "요즘 가장 신기하게 느낀 건 뭐야?",
  },
  // 봄(3월): 기록 1개 — 인용 카드
  "2026-03:0": { answer: "엄마, 꽃이 왜 봄에만 나와? 꽃도 겨울에는 이불 덮고 자는 거야?" },
  // 겨울(1월): 이모지
  "2026-01:2": { answer: "눈이 오는 날 장갑을 한 짝만 끼고 나가서 \"한 손은 눈이랑 악수하려고\"라고 했다 ⛄️" },
  // 아주 긴 글 + 긴 질문 (여름 6월)
  "2026-06:1": {
    question: "아이가 요즘 가장 자주 하는 말, 가장 좋아하는 놀이, 그리고 그때 표정이 어땠는지 기억나는 대로 이야기해 줄래?",
    answer:
      "요즘 하루 종일 \"왜요?\"를 달고 산다. 아침에 일어나면 \"왜 아침이에요?\"로 시작해서, 밥을 먹으면서는 \"왜 밥은 따뜻해요?\", 양치를 하면서는 \"왜 이는 닦아야 해요?\"를 묻는다. 처음에는 하나하나 대답해 줬는데 이제는 \"너는 왜 그렇다고 생각해?\"라고 되물어 본다. 그러면 한참을 고민하다가 자기만의 대답을 내놓는데, 그게 너무 엉뚱하고 귀여워서 매번 웃게 된다.\n\n어제는 \"왜 비가 와요?\"라고 묻길래 \"하늘에 있는 구름이 물을 너무 많이 먹어서 뱉는 거야\"라고 했더니, 고개를 끄덕이며 \"그럼 구름은 배탈 난 거예요?\" 하고 걱정스러운 얼굴로 물었다. 아니라고 하자 \"다행이다. 구름 약 사 줘야 되는 줄 알았어\" 하고 안도했다. 🌧️☁️\n\n제일 좋아하는 놀이는 여전히 블록 쌓기다. 높이 쌓다가 무너지면 처음에는 울상을 짓더니, 요즘은 \"괜찮아, 다시 하면 돼\"라고 스스로 말하고 다시 쌓는다. 그 말을 듣는 순간 어른인 내가 더 많이 배웠다는 생각이 들었다. 이 모습을 오래 기억하고 싶어서 길게 적어 둔다.",
  },
  // 가장 긴 글: 카드에는 다 못 담긴다 (겨울 12월, 기록 2개 중 하나)
  "2025-12:1": {
    answer: Array.from({ length: 14 }, (_, i) => `${i + 1}. ${SENTENCES[(i * 7) % SENTENCES.length]} ${LONG_EXTRA[i % LONG_EXTRA.length]}`).join("\n"),
  },
};

function answerFor(index: number, month: string, order: number): { answer: string; question: string } {
  const special = SPECIAL[`${month}:${order}`];
  const sentenceCount = 1 + ((index * 5) % 3); // 1~3문장
  const picked = Array.from({ length: sentenceCount }, (_, i) => SENTENCES[(index * 7 + i * 11) % SENTENCES.length]);
  return {
    answer: special?.answer ?? picked.join(" "),
    question: special?.question ?? QUESTIONS[(index * 3) % QUESTIONS.length],
  };
}

// ---- 사진 (그림만 있는 PNG. 실제 아이 사진이 아니다) ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}
/** 하늘 그라데이션 + 언덕 + 해가 있는 간단한 풍경 PNG */
function samplePhoto(seed: number): Buffer {
  const width = 720;
  const height = 900;
  const hue = (seed * 47) % 360;
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min((n + h / 30) % 12 - 3, 9 - ((n + h / 30) % 12), 1));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  };
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const hill = 650 + Math.sin(x / 90 + seed) * 40;
      const sunDistance = Math.hypot(x - (150 + (seed % 5) * 90), y - 220);
      let rgb: [number, number, number];
      if (sunDistance < 70) rgb = [255, 232, 140];
      else if (y > hill) rgb = hslToRgb((hue + 120) % 360, 0.35, 0.42 - ((y - hill) / height) * 0.2);
      else rgb = hslToRgb(hue, 0.55, 0.88 - (y / height) * 0.3);
      raw.set(rgb, rowStart + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 사진을 붙일 기록: 달 → 몇 번째 기록들 (봄·여름·가을·겨울 달과 사진 없는 달을 섞는다)
const PHOTO_ENTRIES: Record<string, number[]> = {
  "2026-10": [1],
  "2026-09": [0, 2],
  "2026-06": [2],
  "2026-03": [0],
  "2026-01": [3],
  "2025-12": [0],
  "2025-08": [1],
  "2025-04": [0],
};

// ---- 만들기 ----
async function seed() {
  if (existsSync(STATE_FILE)) throw new Error(`${STATE_FILE} 가 이미 있다. 먼저 npm run sample:clean 으로 지운다.`);

  const password = randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({ email: SAMPLE_EMAIL, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`계정 만들기 실패: ${created.error?.message ?? "알 수 없음"}`);
  const userId = created.data.user.id;
  const state: State = { email: SAMPLE_EMAIL, password, userId, questionIds: [] };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  const settings = await service
    .from("parent_settings")
    .upsert({ user_id: userId, onboarding_completed_at: new Date().toISOString() });
  if (settings.error) throw new Error(`parent_settings: ${settings.error.code}`);
  const child = await service
    .from("children")
    .insert({ user_id: userId, nickname: "하루", birth_date: "2023-03-14" })
    .select("id")
    .single();
  if (child.error || !child.data) throw new Error(`children: ${child.error?.code}`);
  const childId = child.data.id;

  const plan = planMonths();
  const rows = plan.flatMap(({ month, days }) => days.map((day, order) => ({ month, day, order })));
  const weekStarts = rows.map((row) => mondayOf(row.day));
  if (new Set(weekStarts).size !== weekStarts.length) throw new Error("같은 주에 기록이 둘 이상 잡혔다");

  // 이미 있는 유년(early) 질문은 그대로 쓰고, 없는 주만 샘플용으로 넣는다.
  const existing = await service.from("weekly_questions").select("id, week_start").eq("stage", "early").in("week_start", weekStarts);
  if (existing.error) throw new Error(`weekly_questions: ${existing.error.code}`);
  const questionIdByWeek = new Map(existing.data.map((q) => [q.week_start, q.id]));

  const answers = rows.map((row, index) => answerFor(index, row.month, row.order));
  const toInsert = rows.flatMap((row, index) =>
    questionIdByWeek.has(weekStarts[index])
      ? []
      : [{ week_start: weekStarts[index], body: answers[index].question, stage: "early" }],
  );
  if (toInsert.length > 0) {
    const inserted = await service.from("weekly_questions").insert(toInsert).select("id, week_start");
    if (inserted.error || !inserted.data) throw new Error(`질문 넣기 실패: ${inserted.error?.code}`);
    for (const q of inserted.data) {
      questionIdByWeek.set(q.week_start, q.id);
      state.questionIds.push(q.id);
    }
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }

  const now = Date.now();
  const entryRows = rows.map((row, index) => {
    // 수요일 21:00 KST. 아직 오지 않은 시각이면 한 시간 전으로 당긴다.
    const at = Math.min(Date.parse(`${row.day}T21:00:00+09:00`), now - 3_600_000);
    return {
      user_id: userId,
      child_id: childId,
      weekly_question_id: questionIdByWeek.get(weekStarts[index])!,
      body: answers[index].answer,
      created_at: new Date(at).toISOString(),
      updated_at: new Date(at).toISOString(),
    };
  });
  const entries = await service.from("entries").insert(entryRows).select("id, weekly_question_id");
  if (entries.error || !entries.data) throw new Error(`기록 넣기 실패: ${entries.error?.code} ${entries.error?.message}`);

  // 사진
  const idByKey = new Map<string, string>();
  const entryIdByQuestion = new Map(entries.data.map((e) => [e.weekly_question_id, e.id]));
  rows.forEach((row, index) =>
    idByKey.set(`${row.month}:${row.order}`, entryIdByQuestion.get(questionIdByWeek.get(weekStarts[index])!)!),
  );
  let photoCount = 0;
  for (const [month, orders] of Object.entries(PHOTO_ENTRIES)) {
    for (const order of orders) {
      const entryId = idByKey.get(`${month}:${order}`);
      if (!entryId) continue;
      const path = `${userId}/${randomUUID()}.png`;
      const upload = await service.storage.from("photos").upload(path, samplePhoto(photoCount + 1), { contentType: "image/png" });
      if (upload.error) throw new Error(`사진 올리기 실패: ${upload.error.message}`);
      const linked = await service.from("entry_photos").insert({ user_id: userId, entry_id: entryId, path });
      if (linked.error) throw new Error(`사진 연결 실패: ${linked.error.code}`);
      photoCount += 1;
    }
  }

  console.log(`샘플 기록 ${entries.data.length}개, 사진 ${photoCount}장, 새 질문 ${state.questionIds.length}개를 넣었다.`);
  console.log(`기록한 달: ${plan[0].month} ~ ${plan[plan.length - 1].month}. 확인용 로그인 정보는 ${STATE_FILE} (git 제외).`);
  console.log("달별 기록 수:", plan.map((p) => `${p.month}=${p.days.length}`).join(" "));
  await yearly();
}

// ---- 매년 같은 질문 (2025년 답. 키는 src/lib/yearly-questions.ts 와 같다) ----
const YEARLY_2025: Record<string, string> = {
  growth: "키 92cm, 몸무게 13kg쯤이에요. 작년에 입던 바지는 이제 발목 위로 올라와요. 신발은 160에서 175로 바뀌었어요.",
  favorites: "공룡과 소방차, 그리고 엄마가 만들어 주는 계란말이를 제일 좋아해요. 자기 전에는 \"반짝반짝 작은 별\"을 꼭 불러야 해요.",
  words: "\"내가 할 거야!\"와 \"왜요?\"를 하루에 백 번은 해요. 사랑해를 \"사앙해\"라고 발음하는데 너무 귀여워서 고쳐 주지 않고 있어요.",
  dream: "소방차 아저씨가 되고 싶대요. 불도 끄고 고양이도 구해 줄 거라고 해요.",
  message: "1년 뒤의 하루야, 그때도 엄마 아빠한테 \"사앙해\"라고 말해 줄래? 지금처럼 웃으면서 건강하게 자라 주렴.",
};

async function yearly() {
  if (!existsSync(STATE_FILE)) throw new Error(`${STATE_FILE} 가 없다. 먼저 npm run sample:seed 를 실행한다.`);
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
  const child = await service.from("children").select("id").eq("user_id", state.userId).single();
  if (child.error || !child.data) throw new Error(`children: ${child.error?.code}`);
  const rows = Object.entries(YEARLY_2025).map(([question_key, body]) => ({
    user_id: state.userId,
    child_id: child.data.id,
    year: 2025,
    question_key,
    body,
  }));
  const saved = await service.from("yearly_answers").upsert(rows, { onConflict: "child_id,year,question_key" });
  if (saved.error) throw new Error(`yearly_answers: ${saved.error.code}`);
  console.log(`2025년 매년 같은 질문 답 ${rows.length}개를 넣었다 (계정을 지우면 함께 지워진다).`);
}

// ---- 지우기 ----
async function clean() {
  if (!existsSync(STATE_FILE)) throw new Error(`${STATE_FILE} 가 없다. 지울 샘플이 없다.`);
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;

  const photos = await service.storage.from("photos").list(state.userId, { limit: 1000 });
  if (photos.data && photos.data.length > 0) {
    await service.storage.from("photos").remove(photos.data.map((file) => `${state.userId}/${file.name}`));
  }
  // 계정을 지우면 아이·기록·사진 행이 함께 지워진다(on delete cascade). 그 뒤에 샘플용 질문을 지운다.
  const deletedUser = await service.auth.admin.deleteUser(state.userId);
  if (deletedUser.error) throw new Error(`계정 삭제 실패: ${deletedUser.error.message}`);
  if (state.questionIds.length > 0) {
    const deletedQuestions = await service.from("weekly_questions").delete().in("id", state.questionIds);
    if (deletedQuestions.error) throw new Error(`질문 삭제 실패: ${deletedQuestions.error.code}`);
  }
  unlinkSync(STATE_FILE);
  console.log(`샘플 계정과 기록, 샘플용 질문 ${state.questionIds.length}개를 지웠다.`);
}

const command = process.argv[2];
if (command === "seed") await seed();
else if (command === "clean") await clean();
else if (command === "yearly") await yearly();
else throw new Error("사용법: node --env-file=.env.local supabase/dev/sample-entries.ts seed|clean|yearly");
