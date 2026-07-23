// Notion上の5つのデータベースを取得し、data/配下のCSVを再生成する。
// 実行: NOTION_TOKEN=xxx node scripts/sync-notion.mjs
// GitHub Actions（.github/workflows/sync-notion.yml）から手動実行・毎日定期実行される。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.join(ROOT, 'data');

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) {
  console.error('[ERROR] 環境変数 NOTION_TOKEN が設定されていません。');
  process.exit(1);
}

const DB = {
  member:    '80e29672-672f-82c6-abfb-81b84155105c', // 社会情報インフラ部_第1ライン
  threeSE:   '39029672-672f-8008-b635-cd4ca873123c', // 3SEレポート提出状況サマリ
  sales:     '3a529672-672f-803b-b5d0-e70feac72ed5', // 売上データ
  info:      '3a529672-672f-80bb-9dc1-e33637e02fb1', // インフォメーション
  knowledge: '3a529672-672f-80ab-bd6e-c045e34a326a', // ナレッジ・FAQ
};

async function notionQuery(databaseId) {
  const results = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion API error (${databaseId}): ${res.status} ${body}`);
    }
    const json = await res.json();
    results.push(...json.results);
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor);
  return results;
}

// --- Notionプロパティ値の取り出し ---
const getTitle       = (p) => (p?.title || []).map(t => t.plain_text).join('').trim();
const getRichText    = (p) => (p?.rich_text || []).map(t => t.plain_text).join('').trim();
const getSelect      = (p) => p?.select?.name || '';
const getStatus      = (p) => p?.status?.name || '';
const getMultiSelect = (p) => (p?.multi_select || []).map(o => o.name);
const getNumber      = (p) => p?.number ?? 0;
const getDateStart   = (p) => p?.date?.start || '';
function getFormula(p) {
  const f = p?.formula;
  if (!f) return null;
  if (f.type === 'number') return f.number;
  if (f.type === 'string') return f.string;
  if (f.type === 'boolean') return f.boolean;
  if (f.type === 'date') return f.date?.start || null;
  return null;
}

// ISO日付(YYYY-MM-DD) → 「YYYY年M月D日」
function isoToJaDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${y}年${m}月${d}日`;
}

// --- CSV出力 ---
function csvField(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCsv(headers, rows) {
  const lines = [headers.map(csvField).join(',')];
  for (const row of rows) lines.push(headers.map(h => csvField(row[h])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
async function writeCsv(relPath, headers, rows) {
  const filePath = path.join(DATA_DIR, relPath);
  await fs.writeFile(filePath, toCsv(headers, rows), 'utf8');
  console.log(`  wrote ${relPath} (${rows.length} rows)`);
}

async function main() {
  console.log('== member_master.csv ==');
  const memberPages = await notionQuery(DB.member);

  // 既存CSVから「画像」列だけ引き継ぐ（顔写真ファイルの手動管理はCLAUDE.md参照。Notionからは自動取得しない）
  const existingImageByName = new Map();
  try {
    const existing = await fs.readFile(path.join(DATA_DIR, 'members', 'member_master.csv'), 'utf8');
    const [headerLine, ...lines] = existing.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    const headers = headerLine.split(',');
    const nameIdx = headers.indexOf('氏名');
    const imgIdx = headers.indexOf('画像');
    if (nameIdx >= 0 && imgIdx >= 0) {
      for (const line of lines) {
        const cols = line.split(','); // 単純split。既存ファイルに引用符付きフィールドがない前提
        if (cols[nameIdx]) existingImageByName.set(cols[nameIdx], cols[imgIdx] || '');
      }
    }
  } catch { /* 既存ファイルがなければ画像列は空のまま */ }

  const members = memberPages.map(page => {
    const props = page.properties;
    const name = getTitle(props['氏名']);
    return {
      name,
      empNo:    getRichText(props['社員番号']),
      role:     getSelect(props['役職']),
      grade:    getSelect(props['等級']),
      line:     getSelect(props['所属ライン']),
      joinIso:  getDateStart(props['入社年月日']),
      tenure:   getFormula(props['社歴']) || '',
      committee: getMultiSelect(props['委員会']).join(','),
      dest:     getSelect(props['支援先']),
      image:    existingImageByName.get(name) || '',
      status:   getStatus(props['ステータス']),
      note:     getRichText(props['備考']),
    };
  });
  members.sort((a, b) => {
    if (!a.joinIso && !b.joinIso) return 0;
    if (!a.joinIso) return 1;
    if (!b.joinIso) return -1;
    return a.joinIso.localeCompare(b.joinIso);
  });

  await writeCsv(path.join('members', 'member_master.csv'),
    ['氏名','社員番号','役職','等級','所属ライン','入社年月日','社歴','委員会','支援先','画像','ステータス','備考'],
    members.map(m => ({
      '氏名': m.name, '社員番号': m.empNo, '役職': m.role, '等級': m.grade,
      '所属ライン': m.line, '入社年月日': isoToJaDate(m.joinIso), '社歴': m.tenure,
      '委員会': m.committee, '支援先': m.dest, '画像': m.image, 'ステータス': m.status, '備考': m.note,
    })));

  // ステータスが異動/退職のメンバー名（3SEレポートの備考自動判定に使う）
  const inactiveNames = new Map(members.filter(m => m.status === '異動' || m.status === '退職').map(m => [m.name, m.status]));
  const memberOrder = new Map(members.map((m, i) => [m.name, i]));

  console.log('== 3se_report.csv ==');
  const sePages = await notionQuery(DB.threeSE);
  const MONTHS = ['8月','9月','10月','11月','12月','1月','2月','3月','4月','5月','6月','7月'];
  const seRows = sePages.map(page => {
    const props = page.properties;
    const name = getTitle(props['社員番号']); // タイトル列だが実体は氏名
    const row = { '社員番号': name };
    for (const m of MONTHS) row[m] = getNumber(props[m]);
    row['達成状況'] = getFormula(props['達成状況']) || '';
    row['合計'] = getFormula(props['合計']) ?? 0;
    for (const q of ['1Q','2Q','3Q','4Q']) row[q] = getFormula(props[q]) ?? 0;
    row['備考'] = inactiveNames.get(name) || '';
    return row;
  });
  seRows.sort((a, b) => {
    const ia = memberOrder.has(a['社員番号']) ? memberOrder.get(a['社員番号']) : 999;
    const ib = memberOrder.has(b['社員番号']) ? memberOrder.get(b['社員番号']) : 999;
    return ia - ib;
  });
  await writeCsv('3se_report.csv',
    ['社員番号','達成状況','合計', ...MONTHS, '1Q','2Q','3Q','4Q','備考'],
    seRows);

  console.log('== sales.csv ==');
  const salesPages = await notionQuery(DB.sales);
  const salesRows = salesPages.map(page => {
    const props = page.properties;
    return {
      'タイトル': getTitle(props['タイトル']),
      '顧客名': getSelect(props['顧客名']),
      '月': isoToJaDate(getDateStart(props['月'])),
      '予算': getNumber(props['予算']),
      '実績': getNumber(props['実績']),
    };
  });
  await writeCsv('sales.csv', ['タイトル','顧客名','月','予算','実績'], salesRows);

  console.log('== info.csv ==');
  const infoPages = await notionQuery(DB.info);
  const infoRows = infoPages.map(page => {
    const props = page.properties;
    return {
      'タイトル': getTitle(props['タイトル']),
      '本文': getRichText(props['本文']),
      '開始日': getDateStart(props['開始日']),
      '終了日': getDateStart(props['終了日']),
      '種別': getSelect(props['種別']),
    };
  });
  await writeCsv('info.csv', ['タイトル','本文','開始日','終了日','種別'], infoRows);

  console.log('== knowledge.csv ==');
  const knowledgePages = await notionQuery(DB.knowledge);
  const knowledgeRows = knowledgePages.map(page => {
    const props = page.properties;
    return {
      'タイトル': getTitle(props['タイトル']),
      '種別': getSelect(props['種別']),
      'カテゴリ': getSelect(props['カテゴリ']),
      '質問': getRichText(props['質問']),
      '回答・本文': getRichText(props['回答・本文']),
      'サマリー': getRichText(props['サマリー']),
      'タグ': getMultiSelect(props['タグ']).join(','),
      '更新日': getDateStart(props['更新日']),
    };
  });
  await writeCsv('knowledge.csv',
    ['タイトル','種別','カテゴリ','質問','回答・本文','サマリー','タグ','更新日'],
    knowledgeRows);

  console.log('done.');
}

main().catch(e => { console.error(e); process.exit(1); });
