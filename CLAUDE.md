# team-dashboard-fy2027 プロジェクト概要（ClaudeCode用）

---

## ⚠️ このファイルの更新ルール（必読）

作業完了時、以下に該当する変更をした場合は必ずCLAUDE.md（または下記の分離先ファイル）を更新すること。

| 変更内容 | 更新箇所 |
|----------|---------|
| ページを追加・削除した | ファイル構成・開発ドキュメント索引・`docs/dev/pages/<ページ名>.md`（`nav.js`の`NAV_ITEMS`と、配信許可リスト`functions/_middleware.js`の`PAGES`も。共通JS/CSSを追加した場合は`FILES`） |
| ページ・共通スクリプトの仕様や設計判断を変えた | `docs/dev/pages/` または `docs/dev/shared/` の該当ファイル |
| データファイルの構造を変えた | `data/CLAUDE.md`の該当セクション（CSVフォーマット詳細はこちらに分離済み） |
| 新しいデータファイルを追加した | ファイル構成・`data/CLAUDE.md` |
| バッチ・同期・ワークフローの動作を変えた | `docs/dev/operations.md`（概要が変わるならこのファイルの「データ更新フロー（概要）」も） |
| 認証・セキュリティ設定を変えた | `docs/dev/security.md` |
| ライン名・カラーを変えた | `config/org.json`のlines配列・lineLabelMap（詳細は「組織設定」節参照） |
| デプロイ先URLが変わった | 冒頭の公開URL |
| 今後の課題が解決・追加された | 今後の課題セクション |

更新不要：デザイン調整・文言修正・バグ修正など構造に影響しないもの。

---

## 何のアプリか

社会情報インフラ部 第1ライン（9名）向けの社内情報共有ダッシュボード。
FY2027（2026年8月〜2027年7月）用。team-dashboardの来期版として新規作成。
Cloudflare PagesとGitHub（`my000594/team-dashboard-fy2027`）を連携済み。
`main`ブランチにpushすると自動でビルド・デプロイされる（手動ドロップ運用ではない）。
サイト全体にCloudflare Access（会社メールアドレス単位のOne-time PIN認証）がかかっており、許可されたメールアドレスでないと閲覧できない（詳細は「認証（Cloudflare Access）」節）。
公開URL: https://team-dashboard-fy2027.pages.dev

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
├── index.html          トップページ（インフォメーション2列（期限あり最大8件＋恒常全件）＋KPI＋サマリー）
├── info.html           インフォメーション一覧（全件＋アーカイブ）
├── member.html         メンバー（第1ライン・第1-1ライン）
├── reports.html        3SEレポート提出状況
├── sales.html          売上・数字（予算vs実績・顧客別展開）
├── knowledge.html      ナレッジ・FAQ
├── meetings.html       ライン別会議実施計画（方針＋月別実施計画一覧）
├── skill.html          スキルマップ（マトリクス・レーダーチャート・スキル検索）
├── career.html         キャリアロードマップ（等級・昇格基準の確認ツール。データはCSVではなくHTML内にハードコーディング）
├── chronicle.html      ライン年表（入社・異動・退職・ライン別MVP・資格取得・イベントの時系列記録）
├── portfolio.html      個人ポートフォリオ（?member=氏名でCSVから動的生成。nav.jsメニュー非掲載・member.htmlのカードクリックからのみアクセス）
├── maintenance-app.html 課長本人用のメンテナンス切替スマホアプリ風ページ（nav.jsのメニューには載せない管理者専用ツール）
├── style.css           全ページ共通スタイル（ダークテーマ）
├── nav.js              左サイドバーナビ＋メンテナンス制御
├── md.js               本文のMarkdown描画共通レンダラ（index/info/knowledgeで共用）
├── data.js             CSV取得共通ヘルパー（sessionStorageに5分キャッシュ。CSVをfetchする全ページで共用）
├── you-widget.js        「あなたの状況」ウィジェット共通スクリプト（全ページのpage-headerで共用）
├── robots.txt           検索エンジン避け（全ページDisallow）
├── functions/           Cloudflare Pages Functions（knowledge.htmlの👍投票API。詳細は後述。npm依存なし・ビルドコマンド不要）
│   ├── _middleware.js        サイト全体の配信許可リスト（ページ・共通JS/CSS・config/org.json・data/だけを通し、docs/・CLAUDE.md・scripts/等は404。docs/dev/security.md参照）
│   └── api/
│       ├── _middleware.js    /api配下をCloudflare AccessのJWT検証（Web Crypto APIのみで自前実装）で保護
│       └── knowledge-votes.js ナレッジ👍投票のGET（集計取得）/POST（トグル）
├── scripts/
│   ├── sync-notion.mjs Notion APIからdata/配下のCSVを自動生成するスクリプト
│   ├── knowledge_votes_schema.sql 👍投票用D1データベースの初期スキーマ（Cloudflareダッシュボードで手動実行）
│   └── check-consistency.mjs 重複定義・共通の約束事の整合性チェック（依存なし。`node scripts/check-consistency.mjs`）
├── .github/workflows/
│   ├── sync-notion.yml  上記スクリプトを実行するGitHub Actions（手動実行＋毎日自動実行）
│   └── maintenance.yml  メンテナンスモードのON/OFFを手動実行（workflow_dispatch）で切り替えるGitHub Actions
├── update_csv.bat      3SEレポートCSV更新バッチ（手動運用時のフォールバック）
├── update_master.bat   メンバーマスタCSV更新バッチ（同上）
├── update_sales.bat    売上CSV更新バッチ（同上）
├── update_info.bat     インフォメーションCSV更新バッチ（同上）
├── update_knowledge.bat ナレッジCSV更新バッチ（同上）
├── CLAUDE.md           このファイル
├── .claude/agents/docs-sync.md  ドキュメント更新漏れを洗い出すサブエージェント（「作業の締めくくり」節参照）
├── .claude/skills/dashboard-setup/SKILL.md  他部署・他組織へ渡した先での初期セットアップを対話で進めるスキル（`/dashboard-setup`で起動。自動起動はしない）
├── config/
│   └── org.json        組織固有設定（ライン名・管理者名・カラー・参考メンバー等。詳細は「組織設定」節参照）
└── data/
    ├── CLAUDE.md           data/配下CSVのフォーマット詳細（ネストされたメモリファイル。data/を読み書きする時だけ自動で読み込まれる）
    ├── maintenance.json    メンテナンス制御
    ├── 3se_report.csv      3SEレポート（Notionエクスポート）
    ├── sales.csv           売上データ（Notionエクスポート・縦持ち）
    ├── info.csv            インフォメーション（Notionエクスポート）
    ├── knowledge.csv       ナレッジ・FAQ（Notionエクスポート）
    ├── meeting_plan.csv    ライン別会議実施計画（Notionエクスポート）
    ├── 3se_report_archive.csv 3SEレポート事例集（Notionエクスポート。氏名・提出日・ファイルリンクのみのシンプル構成）
    ├── skill.csv           スキルマップ（Notionエクスポート・縦持ち）
    ├── certifications.csv  保有資格（Notionエクスポート・縦持ち）
    ├── org_chart.csv       組織構成図リンク一覧（Notion「組織構成」ページ本文から自動抽出）
    ├── chronicle.csv       ライン年表（Notionエクスポート）
    ├── members/
    │   ├── member_master.csv   メンバーマスタ（Notionエクスポート）
    │   └── 氏名.png            顔写真（個人名でリネーム・手動管理）
    └── knowledge_images/    ナレッジ本文に常時確実に表示したい画像（外部ドライブ経由の認証問題を避けるための手動管理領域。詳細は`docs/dev/shared/md-js.md`参照）
└── docs/
    ├── skill_hearing_sheet.xlsx  スキル・保有資格ヒアリングシート（部下配布用のフォーマット。GitHubにフォーマットとして置いているだけ。`functions/_middleware.js`の配信許可リストによりサイトからは404になる。docs/配下のmd・CLAUDE.md等も同様）
    ├── spec.md              仕様書（人間向け。仕組み・技術スタック・ページ構成の概要）
    ├── user_manual.md       ユーザーマニュアル（部下向け。アクセス方法・各ページの使い方）
    ├── admin_manual.md      管理マニュアル（管理者向け。データ更新・メンバー管理・Access管理・トラブル対応の手順）
    ├── PATTERNS.md          パターン集（他部署・他社へ展開する際の「サンプル実装ページの型」。career/sales/reports/meetings/chronicleが対象。詳細は当該節参照）
    └── dev/                 開発メモ（Claude Code向け。ページ・共通スクリプト・運用の詳細。「開発ドキュメント索引」節参照）
        ├── pages/*.md       ページごとの仕様・設計判断（12ファイル）
        ├── shared/*.md      md.js / data.js / you-widget.js / nav.js
        ├── operations.md    データ更新フロー詳細
        └── security.md      認証・セキュリティ詳細
```

---

## 組織設定（config/org.json）

このダッシュボードを他部署・他社に渡す際の「組織固有値の差し替え口」として2026-09-11に導入。ライン名・管理者名・カラー・所属ラインの表記ゆれ変換・参考メンバー・スキル評価時期など、渡す相手ごとに変わる値をこのファイル1つに集約している。渡す際はこのファイルの中身を書き換えるだけでよい（コード本体には手を入れない）。

```json
{
  "orgLabel": "SI部 第1ライン",
  "fyLabel": "FY2027 Dashboard",
  "lines": [
    { "key": "第1ライン",   "manager": "米花 雅史", "color": "#3b82f6", "bg": "rgba(59,130,246,0.12)" },
    { "key": "第1-1ライン", "manager": "伊藤 良多", "color": "#22c55e", "bg": "rgba(34,197,94,0.12)"  }
  ],
  "lineLabelMap": { "百瀬 陽一Bライン": "第1ライン", "米花雅史Ｋライン": "第1-1ライン" },
  "referenceMembers": ["百瀬 陽一"],
  "skillPeriods": ["2026年8月", "2026年11月", "2027年2月", "2027年5月"]
}
```

- 参照元：`nav.js`（`orgLabel`/`fyLabel`をサイドバーのロゴ表記に使用）、`member.html`（`lines`→`LINE_ORDER`/`LINE_META`/`LINE_COLORS`、`lineLabelMap`→`LINE_LABEL_MAP`、`referenceMembers`→`REFERENCE_MEMBERS`）、`skill.html`（`skillPeriods`→`PERIODS`、`referenceMembers`→`REFERENCE_MEMBERS`）、`index.html`（`referenceMembers`→課員数カウントから参考メンバーを除外する判定）。各ページの`loadOrgConfig()`（またはindex.htmlは`Promise.all`内の直接fetch）が`config/org.json`を取得し、CSV取得と同じタイミングで該当する変数に反映する
- **取得に失敗しても現行運用と同じ値にフォールバックする**（各ページの`applyOrgConfig()`内にデフォルト値としてハードコード済み）。`config/org.json`自体を配布物から削除してしまっても表示は壊れない設計
- ライン・管理者・カラーを変える場合はこのファイルの`lines`配列を編集するだけでよい。`member.html`側の定数を直接触る必要はなくなった（2026-09-11、パッケージ配布を見据えた改修）
- `skillPeriods`はスキル評価時期の一次情報源。ただし`scripts/sync-notion.mjs`の`SKILL_PERIODS`・`you-widget.js`の`YOU_SKILL_PERIODS`・`portfolio.html`の`PERIODS`は独立した定数のままなので、新しい時期を追加する際はこの4箇所（`config/org.json`・`scripts/sync-notion.mjs`・`you-widget.js`・`portfolio.html`）を揃えて更新すること（`skill.html`のフォールバック値も含め、`node scripts/check-consistency.mjs`で一致を確認できる。portfolio.htmlは2026-11-08の整合性チェック導入時に4箇所目として判明）
- career.html（等級・昇格基準）・meetings.html（方針文）・sales.html・reports.html・chronicle.htmlは、御社固有の制度・実データに強く依存するためconfig化していない。他組織に渡す場合はコードごと「参考実装」として渡し、その組織の実情に合わせて作り直してもらう方針（詳細は今後の課題・展開方針を参照）

---

## 技術スタック

- 純粋なHTML / CSS / JavaScript（フレームワークなし）
- Chart.js 4.4.1（グラフ描画）
- PapaParse 5.4.1（CSV読み込み）
- Google Fonts（Noto Sans JP / DM Mono）
- 外部CDNのみ、ビルド不要（Cloudflare Pages Functions（`functions/`）も含めて完全に依存なし）
- このダッシュボードは元々「Notion→CSV→git push→自動デプロイ」の完全な読み取り専用サイトだったが、knowledge.htmlの👍投票機能で初めて即時の書き込みが必要になったため、2026-08-19にPages Functions＋D1というレイヤーを追加した。Cloudflare Access JWTの検証にnpmパッケージ（`@cloudflare/pages-plugin-cloudflare-access`）を使う設計を最初に試したが、**このプロジェクトはPagesのビルドコマンドを設定していないためnpm installがスキップされ、Functionsのバンドル時に依存パッケージを解決できずビルド自体が失敗した**（2026-08-19に本番デプロイで実際に発生）。ビルドコマンドを追加する代わりに、JWT検証をWeb Crypto APIのみで自前実装する方式に切り替え、npm依存を完全に排除した（`functions/api/_middleware.js`）。ビルドコマンドを追加してnpmパッケージを使う設計に戻す場合は、この失敗の経緯を踏まえること

---

## デザインシステム（style.css）

ダークテーマ。CSS変数で色・余白を統一管理。

```css
--bg / --bg2 / --bg3 / --bg4       背景色（階層）
--text / --text2 / --text3         文字色（階層）
--blue / --green / --red / --amber / --purple / --cyan / --pink  アクセントカラー
--border / --border2               ボーダー色
--font: Noto Sans JP
--mono: DM Mono
--nav-w: 224px
```

共通コンポーネント：`.card` `.metric` `.badge` `.tbl` `.tabs` `.tab` `.group-section` `.chip`

---

## 開発ドキュメント索引（ページ・共通スクリプト・運用の詳細）

**ページや共通スクリプトを変更する前に、下表の該当ファイルを必ず`Read`してから着手すること。** 過去の不具合の経緯・設計判断・他ページとの連動（例：`NEW_BADGE_DAYS`は2ページ、評価時期は`config/org.json`以外に4ファイルでハードコード）はすべてそちらに書いてある。2026-11-08、ルートCLAUDE.mdが約97KBに肥大化し毎セッションのトークンコストが大きくなったため、作業対象に応じて必要な分だけ読む方式に分割した（`data/CLAUDE.md`の分離と同じ考え方）。

| 変更対象 | 読むファイル |
|----------|-------------|
| `index.html` / `info.html` / `member.html` / `reports.html` / `sales.html` / `knowledge.html` / `meetings.html` / `skill.html` / `career.html` / `chronicle.html` / `portfolio.html` / `maintenance-app.html` | `docs/dev/pages/<ページ名>.md`（例：`skill.html` → `docs/dev/pages/skill.md`） |
| `md.js` | `docs/dev/shared/md-js.md` |
| `data.js` | `docs/dev/shared/data-js.md` |
| `you-widget.js` | `docs/dev/shared/you-widget-js.md` |
| `nav.js`（ナビ追加時の`mini`ラベル等） | `docs/dev/shared/nav-js.md` |
| `scripts/sync-notion.mjs`・`.github/workflows/`・`update_*.bat`・メンテナンス切替 | `docs/dev/operations.md` |
| `functions/`・Cloudflare Access・CDNのSRI・XSSエスケープ | `docs/dev/security.md` |
| `data/`配下のCSV・JSONのフォーマット | `data/CLAUDE.md`（`data/`を読むと自動で読み込まれる） |

- 分離先ファイル内の「〇〇.htmlセクション」「データフォーマット節」等の参照は、上表の対応ファイルを指す（分離前の節名のまま残している）
- 複数ページにまたがる共通部品（you-widget.js等）を変えた場合は、共通スクリプト側のmdに加えて影響するページのmdも確認すること
- 新しいページを追加したら`docs/dev/pages/<ページ名>.md`を新規作成し、この表とファイル構成に追記すること。**`functions/_middleware.js`の`PAGES`への追記も必須**（忘れると本番でそのページが404になる）

### 作業の締めくくり（コミット前）

1. `node scripts/check-consistency.mjs` を実行する（評価時期のハードコード4ファイル・`NEW_BADGE_DAYS`の2ページ・`NAV_ITEMS`の`mini`・各ページの開発ドキュメントの有無・CDNのSRI・robots・you-widgetの読み込み順・配信許可リスト（`functions/_middleware.js`）の記載漏れを機械的に照合。問題があれば終了コード1）
2. ページ・共通スクリプト・同期スクリプト・ワークフロー・`config/org.json`に構造的な変更をした場合は、`docs-sync`サブエージェント（`.claude/agents/docs-sync.md`）に更新漏れを洗い出させ、指摘を反映してからコミットする。デザイン調整・文言修正だけなら不要（トークンコストを抑えるため）

---

## データフォーマット

`data/`配下の各CSV・`maintenance.json`・D1 votesテーブルの詳細なフォーマット仕様は`data/CLAUDE.md`に分離した（2026-08-31、ルートCLAUDE.mdが大きくなってきたため。`data/`配下のファイルを読み書きするときだけClaude Codeが自動で読み込む）。CSVの列構成・Notion側の対応関係・特殊なパース処理等を確認・変更する場合はそちらを参照・更新すること。

---

## データ更新フロー（概要）

- **標準**：Notion → GitHub Actions「Notionからデータ同期」（`scripts/sync-notion.mjs`。毎日6:00 JST自動＋手動実行）→ `data/`配下のCSVを再生成 → 自動commit・push → Cloudflare Pagesが自動デプロイ
- **フォールバック**：Notionの手動エクスポート＋`update_*.bat`
- **メンテナンス切替**：`maintenance-app.html`（スマホ）／GitHub Actions「メンテナンスモード切り替え」／`data/maintenance.json`の直接編集
- 対象DB一覧・リトライ・`section()`による部分失敗の扱い・`assertProperties()`等の詳細は`docs/dev/operations.md`

---

## デプロイフロー

Cloudflare PagesとGitHub（`my000594/team-dashboard-fy2027`）を連携済み。
`main`ブランチにpushすると自動でビルド・デプロイされる（手動でのUpload assets操作は不要）。

---

## 認証・セキュリティ（概要）

- サイト全体（`data/`・`maintenance-app.html`含む）にCloudflare AccessのOne-time PIN認証。許可は**メールアドレスの個別列挙**のため、メンバーの異動・入れ替わりはZero Trust側で都度手動対応が必要
- `functions/api/`の👍投票APIはAccessのJWTをWeb Crypto APIで自前検証（npm依存なし）
- CSV由来の文字列を`innerHTML`に入れる際は必ずエスケープ、CDNスクリプトにはSRIを付与（バージョンを上げたらハッシュも更新）
- 設定の詳細・対応済み事項・既知の限界は`docs/dev/security.md`

---

## 今後の課題・未実装
- NotionのInternal Integration作成・各データベースへの共有・GitHub Secrets（`NOTION_TOKEN`）登録（scripts/sync-notion.mjs運用開始のため）
- 顔写真（氏名.png）の準備・配置
- 実売上データへの置き換え（現在サンプル値）
- デザインのさらなる洗練
- **他部署・他社への展開準備（2026-09-11着手）**：`config/org.json`によるコア部分（member/skill/knowledge/info＋共通基盤）の組織非依存化と、career/sales/reports/meetings/chronicleの「パターン集」化（`docs/PATTERNS.md`）まで完了。残タスク：①渡す際のgit履歴サニタイズ手順の確立（過去コミットに実メンバーの個人情報が残っているため、`git clone`ではなく現時点のファイルのみで新規履歴を作る必要がある。詳細はルートCLAUDE.mdの「組織設定」節および検討の経緯を参照）、②Notion側の複製可能テンプレート（空のDB一式）の用意、③セットアップ手順のAI主導スキル化（2026-11-08に`.claude/skills/dashboard-setup/SKILL.md`として初版作成。実際に他部署で使ってもらった結果を反映して改訂する）、④簡易利用条件（ライセンス）文言の作成
