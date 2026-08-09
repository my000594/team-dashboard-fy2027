// data/配下のCSV取得を共通化するヘルパー。ページ遷移の多いこのダッシュボードで同じCSVを
// 毎回fetchし直さないよう、sessionStorageに短時間キャッシュする（Notion同期は1日単位のため鮮度への影響は小さい）。
const CSV_CACHE_MS = 5 * 60 * 1000; // 5分

// fetch + BOM除去済みのテキストを返す（{ ok, status, text }）。HTTPエラーでも例外は投げず、
// 呼び出し側が従来通りres.okと同じ感覚でtext/statusを判定できるようにする。
// 正常時（ok）のみキャッシュし、404等の失敗はキャッシュせず次回また取得を試みる。
async function fetchCSVText(path) {
  const cacheKey = 'csvcache:' + path;
  const now = Date.now();
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (cached && now - cached.t < CSV_CACHE_MS) return cached;
  } catch { /* 壊れたキャッシュは無視してfetchへ進む */ }

  const res = await fetch(path);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
  const entry = { ok: res.ok, status: res.status, text, t: now };

  if (res.ok) {
    try { sessionStorage.setItem(cacheKey, JSON.stringify(entry)); }
    catch { /* 容量超過等は無視。キャッシュ無しで動作継続 */ }
  }

  return entry;
}
