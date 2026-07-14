// 工程種別・休日はページ間でほぼ変化しないマスタデータのため、
// ページ遷移のたびに再フェッチしないようモジュールスコープでキャッシュする。
// settings画面で編集した場合は invalidateMasterData() で破棄すること。
type MasterData = { processTypes: any[]; holidays: any[] };

let cache: MasterData | null = null;
let inflight: Promise<MasterData> | null = null;

export function getMasterData(): Promise<MasterData> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = Promise.all([
      fetch("/api/process-types").then((r) => r.json()),
      fetch("/api/holidays").then((r) => r.json()),
    ])
      .then(([processTypes, holidays]) => {
        cache = {
          processTypes: Array.isArray(processTypes) ? processTypes : [],
          holidays: Array.isArray(holidays) ? holidays : [],
        };
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateMasterData() {
  cache = null;
  inflight = null;
}
