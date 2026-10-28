// 작성 중인 글(초안)을 이 기기의 localStorage에 임시로 두는 도구 (클라이언트 전용, D-041).
//  - 계정별로 분리한다: 키에 부모 id를 넣어 다른 계정의 초안이 보이지 않게 한다.
//  - 본문만 저장한다(사진은 저장하지 않는다). 저장이 끝나면 지우고, 로그아웃할 때 모두 지우며, 14일이 지나면 버린다.
//  - 서버에는 올리지 않는다. 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 조용히 건너뛴다.
//  - useSyncExternalStore가 읽도록 스냅샷은 문자열(없으면 null)이고, 쓰면 같은 탭의 구독자에게 알린다.

const PREFIX = "ha-draft:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const listeners = new Set<() => void>();

type Stored = { text: string; savedAt: number };

export function draftKey(userId: string, scope: string): string {
  return `${PREFIX}${userId}:${scope}`;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function readDraft(key: string): string | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Stored>;
    if (typeof stored.text !== "string" || typeof stored.savedAt !== "number") return null;
    if (Date.now() - stored.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return stored.text.trim() ? stored.text : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, text: string) {
  try {
    if (text.trim()) {
      window.localStorage.setItem(key, JSON.stringify({ text, savedAt: Date.now() } satisfies Stored));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // 저장소를 쓸 수 없으면 초안 보존만 건너뛴다. 글 자체는 화면에 그대로 있다.
  }
  notify();
}

export function removeDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 위와 같다.
  }
  notify();
}

/** 로그아웃·계정 전환 때: 이 기기에 남은 모든 초안을 지운다. */
export function clearAllDrafts() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // 위와 같다.
  }
  notify();
}

export function subscribeDrafts(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
