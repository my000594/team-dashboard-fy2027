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
  member:      '80e29672-672f-82c6-abfb-81b84155105c', // 社会情報インフラ部_第1ライン
  threeSE:     '39029672-672f-8008-b635-cd4ca873123c', // 3SEレポート提出状況サマリ
  sales:       '3a529672-672f-803b-b5d0-e70feac72ed5', // 売上データ
  info:        '3a529672-672f-80bb-9dc1-e33637e02fb1', // インフォメーション
  knowledge:   '3a529672-672f-80ab-bd6e-c045e34a326a', // ナレッジ・FAQ
  meetingPlan: '3a629672-672f-80a0-8ad7-ce53a48198df', // 実施計画（ライン別会議実施計画）
  skill:       'd94ebc91-0300-4476-b244-2da697341c25', // 📍 スキルマップ
  certification: 'b88a98ca-3014-4f63-9d23-95cafbea9048', // 💯 保有資格
  chronicle:   'a4c700d71a98421d874ee6789f9e6885', // 📖 ライン年表
  reportArchive: 'fc02988a-d0f8-42a3-a00d-5722cf2ca036', // 📚 3SEレポート事例集
};

// データベースではなくページ本文（ブロック）から取得するもの
const PAGE = {
  orgChart: '95f29672-672f-8348-a7b7-01d51e19770c', // 👥 組織構成ページ（「組織構成図」見出し配下のファイル添付）
};

async function notionQuery(databaseId, sorts) {
  const results = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    if (sorts) body.sorts = sorts;
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

async function notionBlockChildren(blockId) {
  const results = [];
  let cursor;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion API error (blocks/${blockId}/children): ${res.status} ${body}`);
    }
    const json = await res.json();
    results.push(...json.results);
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor);
  return results;
}

// --- Notionプロパティ値の取り出し ---
const getTitle       = (p) => (p?.title || []).map(t => t.plain_text).join('').trim();
// hrefが付いたrunはmd.jsが解釈できる[表示](URL)形式に戻す（Notion側で実際にハイパーリンク化されていると
// plain_textだけではURLが失われるため。例：本文中に貼った画像URLがNotion側で自動リンク化されると、
// plain_textには表示テキストしか残らずURLが消える）。
// ただし表示テキストがURLそのもの（＝素のURLを貼ってNotionが自動リンク化しただけ）の場合は
// [URL](URL)という無意味な入れ子にせず生のURLのまま出力する。特に![alt](URL)の中で使われたURL部分が
// 自動リンク化されると、[URL](URL)のせいで画像記法として認識できなくなるため（2026-08-23発覚）。
// 日本語ファイル名等を含むURLは、表示テキストは生の文字列のままだがhrefはNotion側で
// パーセントエンコードされるため単純な文字列比較では一致せず、decodeURIした上で比較する
// （2026-08-23追加発覚：data/knowledge_images/配下の日本語ファイル名画像で再現）。
const sameUrl = (href, text) => {
  if (href === text) return true;
  try { return decodeURI(href) === text; } catch { return false; }
};
const getRichText    = (p) => (p?.rich_text || []).map(t =>
  t.href && !sameUrl(t.href, t.plain_text) ? '[' + t.plain_text + '](' + t.href + ')' : t.plain_text
).join('').trim();
const getSelect      = (p) => p?.select?.name || '';
const getStatus      = (p) => p?.status?.name || '';
const getMultiSelect = (p) => (p?.multi_select || []).map(o => o.name);
const getCheckbox    = (p) => p?.checkbox === true;
const getNumber      = (p) => p?.number ?? 0;
const getDateStart   = (p) => p?.date?.start || '';
// files型プロパティからリンクだけを取り出す（Notionアップロードのfile.urlは期限付きプリサインURLである点に注意）
const getFileLinks   = (p) => (p?.files || []).map(f => f.type === 'external' ? f.external?.url : f.file?.url).filter(Boolean);
// files型プロパティから「名前|URL」形式で取り出す（Notionで設定した表示名を利用。名前未設定時はURLのみ）
const getFileLinksWithName = (p) => (p?.files || []).map(f => {
  const url = f.type === 'external' ? f.external?.url : f.file?.url;
  if (!url) return null;
  return f.name ? `${f.name}|${url}` : url;
}).filter(Boolean);
function getFormula(p) {
  const f = p?.formula;
  if (!f) return null;
  if (f.type === 'number') return f.number;
  if (f.type === 'string') return f.string;
  if (f.type === 'boolean') return f.boolean;
  if (f.type === 'date') return f.date?.start || null;
  return null;
}
// 数値プロパティの型がnumber／formula（数式）／rollupのいずれで作られていても読み取れるようにする汎用ゲッター。
// 予算差（見込）・予算差（実績）はNotion側で計算済みの数式列だが、作り方（formula/rollup）を限定しないための保険
function getNumberAny(p) {
  if (!p) return null;
  if (p.type === 'number') return p.number ?? null;
  if (p.type === 'formula') return p.formula?.type === 'number' ? p.formula.number : null;
  if (p.type === 'rollup') {
    if (p.rollup?.type === 'number') return p.rollup.number;
    if (p.rollup?.type === 'array') {
      const nums = (p.rollup.array || []).map(x => x?.number).filter(n => typeof n === 'number');
      return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
    }
  }
  return null;
}

// ISO日付(YYYY-MM-DD) → 「YYYY年M月D日」
function isoToJaDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${y}年${m}月${d}日`;
}

// --- 既存CSVの読み込み（RFC4180準拠。引用符で囲まれたカンマ・改行を含むフィールドに対応） ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
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
async function countExistingDataRows(relPath) {
  try {
    const text = await fs.readFile(path.join(DATA_DIR, relPath), 'utf8');
    return Math.max(0, parseCsv(text.replace(/^﻿/, '')).length - 1); // ヘッダー行を除く
  } catch { return 0; }
}

let hadEmptyRegression = false;
// Notion側の共有解除・トークン失効・一時的なAPI不調などで0件しか取れなかった場合、
// 既存の正常なCSVを空データで上書きしないようにするガード
async function writeCsv(relPath, headers, rows) {
  const prevCount = await countExistingDataRows(relPath);
  if (rows.length === 0 && prevCount > 0) {
    console.error(`  [WARN] ${relPath}: Notionから0件しか取得できませんでした（既存${prevCount}件）。上書きをスキップします。`);
    hadEmptyRegression = true;
    return;
  }
  const filePath = path.join(DATA_DIR, relPath);
  await fs.writeFile(filePath, toCsv(headers, rows), 'utf8');
  console.log(`  wrote ${relPath} (${rows.length} rows)`);
}

// Notion側でプロパティ名が変更・削除されると、getSelect等は例外を出さずに''を返すため
// 気づかないまま該当項目だけ空欄になり続ける（実際に組織構成図の見出し名変更で発生した）。
// 値が空なのは正常（未入力）だが、プロパティ名そのものが1件目のページに存在しない場合は
// 列名変更の可能性が高いため、ここで検知してエラーとして表面化させる。
function assertProperties(pages, requiredNames, label) {
  if (!pages.length) return; // 0件の場合はwriteCsv側の空データガードに任せる
  const sample = pages[0].properties;
  const missing = requiredNames.filter(name => !(name in sample));
  if (missing.length) {
    throw new Error(`Notion側のプロパティが見つかりません（列名変更・削除の可能性）: ${missing.join('、')}`);
  }
}

let hadSectionErrors = false;
// 1つのDB取得・書き込みが失敗しても他のDBの同期を止めないようにするラッパー。
// GitHub Actions側もコミットステップにif: !cancelled()を設定し、一部失敗時でも成功分は反映されるようにしている
async function section(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.error(`[ERROR] ${label}: ${e.message}`);
    hadSectionErrors = true;
  }
}

// 同一キー（例：氏名+スキル名+サブカテゴリ）の行がNotion側に重複登録されていないか検知して警告する。
// 重複があると後の行が無言で前の行を上書きしてしまうため、ビルドは止めずログにだけ残す
function warnDuplicates(rows, keyFn, label) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [key, count] of counts) {
    if (count > 1) console.warn(`  [WARN] ${label}: 「${key}」が${count}件重複登録されています（後の行が優先され、片方は無視されます）`);
  }
}

async function main() {
  // 3SEレポートのソート・備考自動判定に使う。member_masterセクションが失敗しても
  // 後続セクションが動けるよう、安全なデフォルト値をあらかじめ用意しておく
  let inactiveNames = new Map();
  let memberOrder = new Map();
  let memberNameById = new Map(); // chronicle.csvの「氏名」リレーション解決用

  await section('member_master.csv', async () => {
    console.log('== member_master.csv ==');
    const memberPages = await notionQuery(DB.member);
    assertProperties(memberPages, ['氏名','社員番号','役職','等級','所属ライン','入社年月日','社歴','委員会','支援先','ステータス','備考'], 'member_master.csv');

    // 既存CSVから「画像」列だけ引き継ぐ（顔写真ファイルの手動管理はCLAUDE.md参照。Notionからは自動取得しない）
    const existingImageByName = new Map();
    try {
      const existing = await fs.readFile(path.join(DATA_DIR, 'members', 'member_master.csv'), 'utf8');
      const [headers, ...rows] = parseCsv(existing.replace(/^﻿/, ''));
      const nameIdx = headers.indexOf('氏名');
      const imgIdx = headers.indexOf('画像');
      if (nameIdx >= 0 && imgIdx >= 0) {
        for (const cols of rows) {
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
        dispOrder: props['表示順']?.number ?? null,
      };
    });
    // 表示順（Notion手動並び替えの代替。数値が入っている人を優先）が未設定の場合は入社日順にフォールバック
    members.sort((a, b) => {
      if (a.dispOrder != null && b.dispOrder != null) return a.dispOrder - b.dispOrder;
      if (a.dispOrder != null) return -1;
      if (b.dispOrder != null) return 1;
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
    inactiveNames = new Map(members.filter(m => m.status === '異動' || m.status === '退職').map(m => [m.name, m.status]));
    memberOrder = new Map(members.map((m, i) => [m.name, i]));
    memberNameById = new Map(memberPages.map(p => [p.id, getTitle(p.properties['氏名'])]));
  });

  await section('3se_report.csv', async () => {
    console.log('== 3se_report.csv ==');
    const sePages = await notionQuery(DB.threeSE);
    const MONTHS = ['8月','9月','10月','11月','12月','1月','2月','3月','4月','5月','6月','7月'];
    assertProperties(sePages, ['社員番号', ...MONTHS, '達成状況','合計','1Q','2Q','3Q','4Q'], '3se_report.csv');
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
  });

  await section('3se_report_archive.csv', async () => {
    console.log('== 3se_report_archive.csv ==');
    const archivePages = await notionQuery(DB.reportArchive);
    assertProperties(archivePages, ['氏名','提出日','ファイルリンク'], '3se_report_archive.csv');
    let unresolvedNameCount = 0;
    const archiveRows = archivePages.map(page => {
      const props = page.properties;
      const dateIso = getDateStart(props['提出日']);
      // 氏名はmember_masterへのリレーション。ID→氏名のマップはmember_masterセクションで構築したものを使う（chronicle.csvと同じ方式）
      const relIds = (props['氏名']?.relation || []).map(r => r.id);
      const names = relIds.map(id => memberNameById.get(id)).filter(Boolean);
      unresolvedNameCount += relIds.length - names.length;
      return {
        dateIso,
        '氏名': names.join(','),
        '提出日': dateIso,
        'ファイルリンク': props['ファイルリンク']?.url || '',
      };
    });
    if (unresolvedNameCount > 0) {
      console.warn(`  [WARN] 3se_report_archive.csv: 氏名リレーションが${unresolvedNameCount}件解決できませんでした（member_masterセクションの失敗、または対象メンバーページの削除・変更の可能性）`);
    }
    archiveRows.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    await writeCsv('3se_report_archive.csv', ['氏名','提出日','ファイルリンク'], archiveRows);
  });

  await section('sales.csv', async () => {
    console.log('== sales.csv ==');
    const salesPages = await notionQuery(DB.sales);
    assertProperties(salesPages, ['タイトル','顧客名','月','予算','実績','予算差（見込）','予算差（実績）'], 'sales.csv');
    const salesRows = salesPages.map(page => {
      const props = page.properties;
      return {
        'タイトル': getTitle(props['タイトル']),
        '顧客名': getSelect(props['顧客名']),
        '月': isoToJaDate(getDateStart(props['月'])),
        '予算': getNumber(props['予算']),
        '実績': getNumber(props['実績']),
        // 月が確定するまでは見込、確定後は実績の差分をNotion側の数式で算出したもの（sales.html側で使い分ける）
        '予算差（見込）': getNumberAny(props['予算差（見込）']),
        '予算差（実績）': getNumberAny(props['予算差（実績）']),
      };
    });
    await writeCsv('sales.csv', ['タイトル','顧客名','月','予算','実績','予算差（見込）','予算差（実績）'], salesRows);
  });

  await section('info.csv', async () => {
    console.log('== info.csv ==');
    const infoPages = await notionQuery(DB.info);
    assertProperties(infoPages, ['タイトル','本文','開始日','終了日','種別','表示順'], 'info.csv');
    const infoRows = infoPages.map(page => {
      const props = page.properties;
      return {
        __order: props['表示順']?.number ?? null,
        'タイトル': getTitle(props['タイトル']),
        '本文': getRichText(props['本文']),
        '開始日': getDateStart(props['開始日']),
        '終了日': getDateStart(props['終了日']),
        '種別': getSelect(props['種別']),
        '表示順': props['表示順']?.number ?? '',
      };
    });
    // 表示順が設定されている行を優先し、未設定の行は末尾に回す
    infoRows.sort((a, b) => {
      if (a.__order != null && b.__order != null) return a.__order - b.__order;
      if (a.__order != null) return -1;
      if (b.__order != null) return 1;
      return 0;
    });
    await writeCsv('info.csv', ['タイトル','本文','開始日','終了日','種別','表示順'], infoRows);
  });

  await section('knowledge.csv', async () => {
    console.log('== knowledge.csv ==');
    const knowledgePages = await notionQuery(DB.knowledge);
    assertProperties(knowledgePages, ['タイトル','種別','カテゴリ','質問','回答・本文','サマリー','タグ','更新日','親ナレッジ','子Q&Aである'], 'knowledge.csv');
    // ページID → タイトルのマップ（「親ナレッジ」リレーション解決用）
    const pageTitleMap = new Map();
    for (const page of knowledgePages) {
      pageTitleMap.set(page.id, getTitle(page.properties['タイトル']));
    }
    const knowledgeRows = knowledgePages.map(page => {
      const props = page.properties;
      // 「子Q&Aである」チェックボックスが立っているページだけ、「親ナレッジ」リレーションの
      // 参照先を実の親として採用する（2026-08-09追加）。以前は被参照数の非対称性で親子の
      // 向きを推測していたが、子が1件のみのケースで双方向リレーションの自動back-fillと
      // 区別できない既知の限界があったため、明示フラグに置き換えた。
      const isChild = getCheckbox(props['子Q&Aである']);
      const targetId = (props['親ナレッジ']?.relation || [])[0]?.id;
      const parentTitle = (isChild && targetId) ? (pageTitleMap.get(targetId) || '') : '';
      return {
        __order: props['表示順']?.number ?? null,
        'タイトル': getTitle(props['タイトル']),
        '種別': getSelect(props['種別']),
        'カテゴリ': getSelect(props['カテゴリ']),
        '質問': getRichText(props['質問']),
        '回答・本文': getRichText(props['回答・本文']),
        'サマリー': getRichText(props['サマリー']),
        'タグ': getMultiSelect(props['タグ']).join(','),
        '更新日': getDateStart(props['更新日']),
        '親ナレッジ': parentTitle,
      };
    });
    // 表示順（Notion側で設定した並び順）が設定されている行を優先し、未設定の行は末尾に回す
    knowledgeRows.sort((a, b) => {
      if (a.__order != null && b.__order != null) return a.__order - b.__order;
      if (a.__order != null) return -1;
      if (b.__order != null) return 1;
      return 0;
    });
    await writeCsv('knowledge.csv',
      ['タイトル','種別','カテゴリ','質問','回答・本文','サマリー','タグ','更新日','親ナレッジ'],
      knowledgeRows);
  });

  await section('meeting_plan.csv', async () => {
    console.log('== meeting_plan.csv ==');
    const meetingPages = await notionQuery(DB.meetingPlan);
    assertProperties(meetingPages, ['実施月','実施日','開催単位','実施形式','備考','落とし込み内容'], 'meeting_plan.csv');
    const meetingRows = meetingPages.map(page => {
      const props = page.properties;
      const dateIso = getDateStart(props['実施日']);
      return {
        dateIso,
        '実施月':   getTitle(props['実施月']),
        '実施日':   isoToJaDate(dateIso),
        '開催単位': getSelect(props['開催単位']),
        '実施形式': getMultiSelect(props['実施形式']).join(','),
        '備考':     getRichText(props['備考']),
        '資料リンク': getFileLinksWithName(props['落とし込み内容']).join(','),
      };
    });
    meetingRows.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    await writeCsv('meeting_plan.csv',
      ['実施月','実施日','開催単位','実施形式','備考','資料リンク'],
      meetingRows);
  });

  await section('skill.csv', async () => {
    console.log('== skill.csv ==');
    const skillPages = await notionQuery(DB.skill);
    // ヒアリング実施時期ごとの評価列。新しい時期が追加されたらここに追記し、CLAUDE.mdのデータフォーマット節も更新すること
    const SKILL_PERIODS = ['2026年8月','2026年11月','2027年2月','2027年5月'];
    assertProperties(skillPages, ['タイトル','氏名','スキル名','カテゴリ','サブカテゴリ', ...SKILL_PERIODS, '備考','更新日'], 'skill.csv');
    const skillRows = skillPages.map(page => {
      const props = page.properties;
      const row = {
        __order: props['表示順']?.number ?? null,
        'タイトル': getTitle(props['タイトル']),
        '氏名': getSelect(props['氏名']),
        'スキル名': getSelect(props['スキル名']),
        'カテゴリ': getSelect(props['カテゴリ']),
        'サブカテゴリ': getSelect(props['サブカテゴリ']),
      };
      for (const period of SKILL_PERIODS) row[period] = getNumber(props[period]);
      row['備考'] = getRichText(props['備考']);
      row['更新日'] = getDateStart(props['更新日']);
      return row;
    });
    // 表示順（ヒアリングシートの通し番号）が設定されている行を優先し、未設定の行は末尾に回す
    skillRows.sort((a, b) => {
      if (a.__order != null && b.__order != null) return a.__order - b.__order;
      if (a.__order != null) return -1;
      if (b.__order != null) return 1;
      return 0;
    });
    // 同一人物・同一スキル・同一サブカテゴリの行が重複していると、片方が無言で上書きされてしまうため検知
    warnDuplicates(skillRows, r => r['氏名'] && r['スキル名'] ? `${r['氏名']}_${r['スキル名']}_${r['サブカテゴリ']}` : '', 'skill.csv');
    await writeCsv('skill.csv',
      ['タイトル','氏名','スキル名','カテゴリ','サブカテゴリ', ...SKILL_PERIODS, '備考','更新日'],
      skillRows);
  });

  await section('certifications.csv', async () => {
    console.log('== certifications.csv ==');
    const certPages = await notionQuery(DB.certification);
    assertProperties(certPages, ['資格名','氏名','資格区分','資格分野','資格取得日','有効期限','デジタルバッジ','備考'], 'certifications.csv');
    const certRows = certPages.map(page => {
      const props = page.properties;
      return {
        __order: props['表示順']?.number ?? null,
        '資格名': getTitle(props['資格名']), // タイトル型。資格名を選択肢に縛らず自由記述できるようにするため2026-07-28にselectから変更
        '氏名': getSelect(props['氏名']),
        '資格区分': getSelect(props['資格区分']),
        '資格分野': getSelect(props['資格分野']),
        '資格取得日': getDateStart(props['資格取得日']), // 旧「取得日」から改名
        '有効期限': getDateStart(props['有効期限']),
        // デジタルバッジはNotion直アップロードだと期限付きプリサインURL（時間経過で失効）になる。
        // Credly等の外部サービスや外部ストレージのURLを「リンク」として登録すれば恒久リンクになる（file/externalどちらもgetFileLinksが対応）
        'デジタルバッジ': getFileLinks(props['デジタルバッジ']).join(','),
        '備考': getRichText(props['備考']),
      };
    });
    // 表示順（資格カタログの並び）で並べる。1行＝1人×1資格のため、同じ資格を複数人が持つ場合に
    // 表示順が一部の人の行にしか入っていなくても並びがブレないよう、資格名ごとの最小値（＝資格カタログとしての順位）で比較する
    const certOrderByName = new Map();
    certRows.forEach(r => {
      if (r.__order == null) return;
      const cur = certOrderByName.get(r['資格名']);
      if (cur == null || r.__order < cur) certOrderByName.set(r['資格名'], r.__order);
    });
    certRows.sort((a, b) => {
      const oa = certOrderByName.get(a['資格名']);
      const ob = certOrderByName.get(b['資格名']);
      if (oa != null && ob != null) return oa - ob;
      if (oa != null) return -1;
      if (ob != null) return 1;
      return 0;
    });
    warnDuplicates(certRows, r => r['氏名'] && r['資格名'] ? `${r['氏名']}_${r['資格名']}` : '', 'certifications.csv');
    await writeCsv('certifications.csv',
      ['資格名','氏名','資格区分','資格分野','資格取得日','有効期限','デジタルバッジ','備考'],
      certRows);
  });

  await section('chronicle.csv', async () => {
    console.log('== chronicle.csv ==');
    const chroniclePages = await notionQuery(DB.chronicle);
    assertProperties(chroniclePages, ['タイトル','日付','種別','氏名','詳細','ステータス','添付ファイル'], 'chronicle.csv');
    // member_masterセクションの失敗・個別ページの削除等でIDが解決できなかった件数を数える。
    // memberNameByIdが（member_masterの失敗により）空のまま、氏名だけが全件無言で空欄になり続けるのを防ぐため
    let unresolvedNameCount = 0;
    const chronicleRows = chroniclePages.map(page => {
      const props = page.properties;
      const dateIso = getDateStart(props['日付']);
      // 「氏名」はメンバーマスタへのリレーション（複数選択可・ライン全体向けイベントは空欄）。
      // ID→氏名のマップはmember_masterセクションで構築したものを使う
      const relIds = (props['氏名']?.relation || []).map(r => r.id);
      const names = relIds.map(id => memberNameById.get(id)).filter(Boolean);
      unresolvedNameCount += relIds.length - names.length;
      return {
        dateIso,
        'タイトル': getTitle(props['タイトル']),
        '日付': dateIso,
        '種別': getSelect(props['種別']),
        '氏名': names.join(','),
        '詳細': getRichText(props['詳細']),
        'ステータス': getSelect(props['ステータス']) || '確定',
        '添付ファイル': getFileLinksWithName(props['添付ファイル']).join(','),
      };
    });
    if (unresolvedNameCount > 0) {
      console.warn(`  [WARN] chronicle.csv: 氏名リレーションが${unresolvedNameCount}件解決できませんでした（member_masterセクションの失敗、または対象メンバーページの削除・変更の可能性）`);
    }
    chronicleRows.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    await writeCsv('chronicle.csv', ['タイトル','日付','種別','氏名','詳細','ステータス','添付ファイル'], chronicleRows);
  });

  await section('org_chart.csv', async () => {
    console.log('== org_chart.csv ==');
    // 「組織構成」ページ配下（見出し・トグルなどどんな入れ子でも）にあるファイル添付を、出現順のまま
    // 再帰的にすべて拾う。このページには組織構成図ファイル以外を置かない運用のため、見出し／トグルの
    // 文言でセクションを判定する方式はやめた（Notion側で見出し名が変わると検出できなくなるため）。
    // メンバーDBが埋め込まれた「全体」トグルはchild_databaseとして現れ、file以外は再帰しないため
    // 自然にスキップされる。
    async function collectFiles(blockId, depth = 0) {
      if (depth > 6) return []; // 異常な入れ子に対する保険
      const children = await notionBlockChildren(blockId);
      const rows = [];
      for (const block of children) {
        if (block.type === 'file') {
          const f = block.file;
          const url = f?.type === 'external' ? f.external?.url : f?.file?.url;
          if (!url) continue;
          // 表示名は「ファイル名（クリックしてリネームする欄）」を優先し、無ければキャプションを使う
          const name = (f.name || '').trim();
          const caption = (f.caption || []).map(t => t.plain_text).join('').trim();
          rows.push({ '表示名': name || caption || '組織構成図', 'リンク': url });
        } else if (block.has_children && block.type !== 'child_database' && block.type !== 'child_page') {
          rows.push(...await collectFiles(block.id, depth + 1));
        }
      }
      return rows;
    }
    const rows = await collectFiles(PAGE.orgChart);
    await writeCsv('org_chart.csv', ['表示名', 'リンク'], rows);
  });

  console.log('done.');
  if (hadEmptyRegression || hadSectionErrors) {
    console.error('[ERROR] 一部のデータベースでエラーが発生したか0件しか取得できませんでした。Notion Integrationの共有設定・トークンの有効期限・データベースIDを確認してください（成功したデータは反映されます）。');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
