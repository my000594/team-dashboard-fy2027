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
Cloudflare PagesとGitHub（`my000594/team-dashboard-fy2027`）を連携済み。
`main`ブランチにpushすると自動でビルド・デプロイされる（手動ドロップ運用ではない）。
URLは部下に共有するだけでアクセス可能。
公開URL: （Cloudflare Pagesデプロイ後に記載）

---

## 組織構成

```
社会情報インフラ部 第1ライン（10名）
課長：米花 雅史（ラインオーナー）
  │
  └─ 第1-1ライン（9名）
      ├── リーダー：伊藤 良多
      ├── チーフエンジニア：北岡 佑太
      ├── 嘱託社員：谷野 亘
      ├── 趙 振雲
      ├── ソンウトウ
      ├── 于 孟賢
      ├── 磯 崇大
      ├── 嘱託社員：眞野 哲朗
      └── 劉 華雲（GITより出向）
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
├── scripts/
│   └── sync-notion.mjs Notion APIからdata/配下のCSVを自動生成するスクリプト
├── .github/workflows/
│   └── sync-notion.yml 上記スクリプトを実行するGitHub Actions（手動実行＋毎日自動実行）
├── update_csv.bat      3SEレポートCSV更新バッチ（手動運用時のフォールバック）
├── update_master.bat   メンバーマスタCSV更新バッチ（同上）
├── update_sales.bat    売上CSV更新バッチ（同上）
├── update_info.bat     インフォメーションCSV更新バッチ（同上）
├── update_knowledge.bat ナレッジCSV更新バッチ（同上）
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

**注意：** `member_master.csv`の「所属ライン」列はNotion側で「誰の配下か（上司名ベース）」の表記になっており、会社組織上の名称とは異なる（例：`百瀬 陽一Bライン`＝`第1ライン`、`米花雅史Ｋライン`＝`第1-1ライン`）。member.html内の`LINE_LABEL_MAP`でCSVの生値を組織上のライン名に変換してから表示・集計している。

LINE_COLORS・LINE_META・LINE_LABEL_MAP定数はmember.html内に定義。
ラインが変わった場合、または所属ラインの生値の表記が変わった場合は3つとも更新し、このCLAUDE.mdも更新すること。

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
- 所属ライン列はNotion上の上司名ベース表記（例：`百瀬 陽一Bライン`＝第1ライン、`米花雅史Ｋライン`＝第1-1ライン）。member.htmlで組織上のライン名に変換して表示（詳細は member.html セクション参照）

### data/3se_report.csv（Notionエクスポート）
```
名前,達成状況,合計,8月,9月,10月,1Q,11月,12月,1月,2Q,2月,3月,4月,3Q,5月,6月,7月,4Q,備考
```
- 合計列は使わない（月別直接合算）
- 備考に「異動」「退職」→ 達成判定から除外（集計には含める）

### data/knowledge.csv（Notionエクスポート）
```
タイトル,種別,カテゴリ,質問,回答・本文,サマリー,タグ,更新日
質問タイトル,faq,社内ルール,質問文,回答文,,"タグ1,タグ2",2026-08-01
記事タイトル,article,技術・スキル,,"## 見出し

本文（Markdown）",一行説明,タグ,2026-08-01
```
- 種別：`faq`（Q&Aカード）/ `article`（アコーディオン展開）
- カテゴリ：`社内ルール` / `技術・スキル` / `リンク・連絡先`
- タグ：カンマ区切りで複数指定可 → **1セル内にカンマ区切りで入れ、ダブルクォートで囲むこと**（囲まないとカンマがCSVの列区切りとして解釈され列がずれる）
- article本文はMarkdown記法で入力（Notionでも同様）。改行を含むため**必ずダブルクォートで囲む**
- Notion公式エクスポートは上記のクォート処理を自動で行うため通常は意識不要。手動でCSVを編集する場合のみ注意
- バッチ判定キー：ヘッダーに「種別」「カテゴリ」「タグ」が含まれる

---

## データ更新フロー

### 標準：Notion API自動同期（scripts/sync-notion.mjs）
Notionを手動エクスポートせず、GitHub ActionsからNotion APIを直接叩いてdata/配下のCSVを再生成する。

```
① Notion上の各データベースを更新
② GitHub Actions「Notionからデータ同期」を手動実行（Actionsタブ→Run workflow）
   　または毎日21:00 UTC（6:00 JST）の定期実行を待つ
③ scripts/sync-notion.mjs がNotion APIから最新データを取得しdata/配下のCSVを再生成
④ 変更があれば自動でcommit・push → Cloudflare Pagesが自動デプロイ
```

- 対象データベースID（`scripts/sync-notion.mjs`内`DB`定数）：
  - member: 社会情報インフラ部_第1ライン
  - threeSE: 3SEレポート提出状況サマリ
  - sales: 売上データ
  - info: インフォメーション
  - knowledge: ナレッジ・FAQ
- 認証：NotionのInternal Integrationトークンを GitHub Secrets の `NOTION_TOKEN` に設定して使用
- `member_master.csv`の「画像」列は自動取得せず、既存CSVの値を氏名突き合わせで引き継ぐ（顔写真は引き続き手動管理）
- `3se_report.csv`の「備考」列は、メンバーマスタの「ステータス」が異動/退職の人を自動判定して埋める（手動記入不要になった）
- データベースIDや列構成を変更した場合は`scripts/sync-notion.mjs`と本セクションを更新すること

### フォールバック：手動バッチ運用
Notion APIが使えない場合のみ、従来の手動エクスポート＋バッチ運用を使う。

PowerShellでDownloads内の全 `*ExportBlock*.zip` をスキャンし、CSVのヘッダーで対象ファイルを自動判定して処理。

| バッチ | 判定キー |
|--------|---------|
| update_csv.bat | 「達成状況」 |
| update_master.bat | 「社員番号」 |
| update_sales.bat | 「予算」「実績」「顧客」 |
| update_info.bat | 「開始日」「終了日」「種別」 |
| update_knowledge.bat | 「種別」「カテゴリ」「タグ」 |

```
① Notionからエクスポート → Downloads に *ExportBlock*.zip が保存
② 対応するバッチをダブルクリック
③ data/ 以下のCSVが自動更新
④ git commit・push（pushでCloudflare Pagesが自動デプロイ）
```

### メンテナンス切り替え
```
開始：data/maintenance.json の active を true → git push
復旧：data/maintenance.json の active を false → git push
```

---

## デプロイフロー

Cloudflare PagesとGitHub（`my000594/team-dashboard-fy2027`）を連携済み。
`main`ブランチにpushすると自動でビルド・デプロイされる（手動でのUpload assets操作は不要）。

---

## 今後の課題・未実装
- Cloudflare Pages公開URLの確定・記載
- NotionのInternal Integration作成・各データベースへの共有・GitHub Secrets（`NOTION_TOKEN`）登録（scripts/sync-notion.mjs運用開始のため）
- 顔写真（氏名.png）の準備・配置
- 実売上データへの置き換え（現在サンプル値）
- デザインのさらなる洗練
