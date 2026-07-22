# team-dashboard-fy2027 プロジェクト概要（ClaudeCode用）

---

## ⚠️ このファイルの更新ルール（必読）

作業完了時、以下に該当する変更をした場合は必ずCLAUDE.mdを更新すること。

| 変更内容 | 更新箇所 |
|----------|---------|
| ページを追加・削除した | ファイル構成・ナビゲーション・ページ別詳細 |
| データファイルの構造を変えた | データフォーマットの該当セクション |
| 新しいデータファイルを追加した | ファイル構成・データフォーマット |
| バッチの動作を変えた | データ更新フローの該当セクション |
| ライン名・カラーを変えた | データフォーマット → LINE_COLORSの対応表 |
| デプロイ先URLが変わった | 冒頭の公開URL |
| 今後の課題が解決・追加された | 今後の課題セクション |

更新不要：デザイン調整・文言修正・バグ修正など構造に影響しないもの。

---

## 何のアプリか

社会情報インフラ部 第1ライン（9名）向けの社内情報共有ダッシュボード。
FY2027（2026年8月〜2027年7月）用。team-dashboardの来期版として新規作成。
Cloudflare Pagesで公開。URLは部下に共有するだけでアクセス可能。
GitHubとは連携していない（Cloudflare Pagesへの手動ドロップ運用）。
公開URL: （Cloudflare Pagesデプロイ後に記載）

---

## 組織構成

```
社会情報インフラ部 第1ライン（9名）
課長：米花 雅史（ラインオーナー）
  │
  └─ 第1-1ライン（8名）
      ├── リーダー：伊藤 良多
      ├── チーフエンジニア：北岡 佑太
      ├── 嘱託社員：谷野 亘
      ├── 趙 振雲
      ├── ソンウトウ
      ├── 于 孟賢
      ├── 磯 崇大
      └── 嘱託社員：眞野 哲朗
```

---

## ファイル構成

```
team-dashboard-fy2027/
├── index.html          トップページ（KPI＋インフォメーション＋サマリー）
├── member.html         メンバー（第1ライン・第1-1ライン）
├── reports.html        3SEレポート提出状況
├── sales.html          売上・数字（予算vs実績・顧客別展開）
├── knowledge.html      ナレッジ・FAQ
├── style.css           全ページ共通スタイル（ダークテーマ）
├── nav.js              左サイドバーナビ＋メンテナンス制御
├── update_csv.bat      3SEレポートCSV更新バッチ
├── update_master.bat   メンバーマスタCSV更新バッチ
├── update_sales.bat    売上CSV更新バッチ
├── update_info.bat     インフォメーションCSV更新バッチ
├── update_knowledge.bat ナレッジCSV更新バッチ
├── CLAUDE.md           このファイル
└── data/
    ├── maintenance.json    メンテナンス制御
    ├── 3se_report.csv      3SEレポート（Notionエクスポート）
    ├── sales.csv           売上データ（Notionエクスポート・縦持ち）
    ├── info.csv            インフォメーション（Notionエクスポート）
    ├── knowledge.csv       ナレッジ・FAQ（Notionエクスポート）
    └── members/
        ├── member_master.csv   メンバーマスタ（Notionエクスポート）
        └── 氏名.png            顔写真（個人名でリネーム・手動管理）
```

---

## 技術スタック

- 純粋なHTML / CSS / JavaScript（フレームワークなし）
- Chart.js 4.4.1（グラフ描画）
- PapaParse 5.4.1（CSV読み込み）
- Google Fonts（Noto Sans JP / DM Mono）
- 外部CDNのみ、ビルド不要

---

## デザインシステム（style.css）

ダークテーマ。CSS変数で色・余白を統一管理。

```css
--bg / --bg2 / --bg3 / --bg4       背景色（階層）
--text / --text2 / --text3         文字色（階層）
--blue / --green / --red / --amber / --purple / --cyan  アクセントカラー
--border / --border2               ボーダー色
--font: Noto Sans JP
--mono: DM Mono
--nav-w: 224px
```

共通コンポーネント：`.card` `.metric` `.badge` `.tbl` `.tabs` `.tab` `.group-section` `.chip`

---

## ナビゲーション・メンテナンス（nav.js）

- ページ読み込み時に `data/maintenance.json` をfetch
- `active: true` で全ページがメンテナンス画面に切り替わる
- ロゴ・サブタイトルは「第1ライン / FY2027 Dashboard」

---

## ページ別詳細

### index.html（トップ）
- 4ファイルを並行fetch：3se_report.csv / sales.csv / member_master.csv / info.csv
- インフォメーション：期間内のものだけ表示、期限近い順、残7日以内は赤強調
- 課員数は member_master.csv の在籍者数から取得
- 3SE件数は月別列を直接合算（calcTotal関数）
- 売上は sales.csv の実績>0の行を集計

### member.html（メンバー）
- ステータスが「在籍」の行のみ表示、CSV行順固定
- タブ5種：ALL / ライン別 / 役職別 / 等級別 / 委員会別
- 顔写真：`data/members/氏名.png`（Notionの氏名と完全一致）
- 社歴：入社年月日からJavaScriptで自動計算（calcTenure）
- 備考・社歴・画像列はCSVから読まない

ライン別タブのLINE_META（管理者名）：
```javascript
'第1ライン':   { manager: '米花 雅史' }
'第1-1ライン': { manager: '伊藤 良多' }
```

LINE_COLORSとLINE_META定数はmember.html内に定義。
ラインが変わった場合は両方更新し、このCLAUDE.mdも更新すること。

### reports.html（3SEレポート）
- 集計（件数・グラフ）は全員（退職・異動含む）
- 達成判定は在籍者のみ
- 件数はcalcTotal関数（月別直接合算、合計列は使わない）
- テーブル：在籍者（件数降順）→ 退職・異動者（件数降順）

### sales.html（売上）
- `data/sales.csv` を縦持ち形式でfetch・集計
- 単位：千円（表示は数字のみ、凡例に「単位：千円」と明記）
- 顧客別にクリックで月別詳細展開（予算・実績・達成率）
- ヒートマップ：顧客×月の達成率を色で表示
- 実績=0の月は「未確定」として「—」表示

### knowledge.html（ナレッジ・FAQ）
- `data/knowledge.csv` をfetchしてPapaParseで解析
- 種別「faq」→ Q&Aカード、「article」→ アコーディオン展開（Markdown対応）
- カテゴリフィルター＋キーワード検索（タイトル・本文・タグ対象）

---

## データフォーマット

### data/maintenance.json
```json
{ "active": false, "message": "...", "estimated": "..." }
```

### data/info.csv（Notionエクスポート）
```
タイトル,本文,開始日,終了日,種別
社内規定検定,説明文,2026/08/01,2026/09/30,deadline
```
- 種別セレクト：`deadline`（赤）/ `event`（青）/ `info`（緑）
- 今日が開始日〜終了日の範囲内のものだけ表示

### data/sales.csv（Notionエクスポート・縦持ち）
```
顧客名,月,予算,実績
CTC,2026/08/01,3000,3240
```
- 月は日付型（2026/08/01形式）
- 予算・実績は数値型、単位：千円
- 実績=0は未確定月
- バッチ判定キー：ヘッダーに「予算」「実績」「顧客」が含まれる

### data/members/member_master.csv（Notionエクスポート）
```
氏名,社員番号,役職,等級,所属ライン,入社年月日,社歴,委員会,支援先,画像,ステータス,備考
```
- ステータス「在籍」のみ表示
- 社歴・画像・備考列は参照しない

### data/3se_report.csv（Notionエクスポート）
```
名前,達成状況,合計,8月,9月,10月,1Q,11月,12月,1月,2Q,2月,3月,4月,3Q,5月,6月,7月,4Q,備考
```
- 合計列は使わない（月別直接合算）
- 備考に「異動」「退職」→ 達成判定から除外（集計には含める）

### data/knowledge.csv（Notionエクスポート）
```
タイトル,種別,カテゴリ,質問,回答・本文,サマリー,タグ,更新日
質問タイトル,faq,社内ルール,質問文,回答文,,タグ1,タグ2,2026-08-01
記事タイトル,article,技術・スキル,,## 見出し

本文（Markdown）,一行説明,タグ,2026-08-01
```
- 種別：`faq`（Q&Aカード）/ `article`（アコーディオン展開）
- カテゴリ：`社内ルール` / `技術・スキル` / `リンク・連絡先`
- タグ：カンマ区切りで複数指定可
- article本文はMarkdown記法で入力（Notionでも同様）
- バッチ判定キー：ヘッダーに「種別」「カテゴリ」「タグ」が含まれる

---

## データ更新フロー

### バッチ共通の仕組み
PowerShellでDownloads内の全 `*ExportBlock*.zip` をスキャン。
CSVのヘッダーで対象ファイルを自動判定して処理。

| バッチ | 判定キー |
|--------|---------|
| update_csv.bat | 「達成状況」 |
| update_master.bat | 「社員番号」 |
| update_sales.bat | 「予算」「実績」「顧客」 |
| update_info.bat | 「開始日」「終了日」「種別」 |
| update_knowledge.bat | 「種別」「カテゴリ」「タグ」 |

### 各データ更新手順
```
① Notionからエクスポート → Downloads に *ExportBlock*.zip が保存
② 対応するバッチをダブルクリック
③ data/ 以下のCSVが自動更新
④ team-dashboard-fy2027フォルダをCloudflare PagesにドロップID
```

### インフォメーション更新
```
Notionのインフォメーションデータベースを更新
→ update_info.bat 実行
→ data/info.csv 更新
→ Cloudflare Pagesにドロップ
```

### メンテナンス切り替え
```
開始：data/maintenance.json の active を true → デプロイ
復旧：data/maintenance.json の active を false → デプロイ
```

---

## デプロイフロー

```
Cloudflare Pages（team-dashboard-fy2027プロジェクト）
→ Deployments タブ右上の「Upload assets」アイコン
→ team-dashboard-fy2027フォルダをドロップ
→ 数秒で反映
```

---

## 今後の課題・未実装
- Cloudflare Pages公開URLの確定・記載
- 実際のNotionデータベースからのCSVエクスポート確認
- 顔写真（氏名.png）の準備・配置
- 実売上データへの置き換え（現在サンプル値）
- デザインのさらなる洗練
