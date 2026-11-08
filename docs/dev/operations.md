# データ更新フロー（Notion同期・手動バッチ・メンテナンス切替）

> ルート`CLAUDE.md`から分離した開発メモ（2026-11-08）。該当ファイルを変更する前に読み、構造に関わる変更をしたらここを更新すること。
> 文中の「〇〇.htmlセクション」は`docs/dev/pages/〇〇.md`、「△△.js節」は`docs/dev/shared/`、「データフォーマット節」は`data/CLAUDE.md`、「組織設定」節・「技術スタック」節はルート`CLAUDE.md`を指す。


## 標準：Notion API自動同期（scripts/sync-notion.mjs）
Notionを手動エクスポートせず、GitHub ActionsからNotion APIを直接叩いてdata/配下のCSVを再生成する。

```
① Notion上の各データベースを更新
② GitHub Actions「Notionからデータ同期」を手動実行（Actionsタブ→Run workflow）
   　または毎日21:00 UTC（6:00 JST）の定期実行を待つ
③ scripts/sync-notion.mjs がNotion APIから最新データを取得しdata/配下のCSVを再生成
④ 変更があれば自動でcommit・push → Cloudflare Pagesが自動デプロイ
```

- Notion API呼び出しの一時的な不調・ネットワーク瞬断に備え、`.github/workflows/sync-notion.yml`は`sync-notion.mjs`の実行失敗時に30秒間隔で最大3回リトライする（2026-08-09追加）。スクリプトはNotionから再取得してCSVを上書きするだけの冪等な処理のため、リトライしても副作用はない。3回とも失敗した場合のみワークフローが失敗として終了する

- 対象データベースID（`scripts/sync-notion.mjs`内`DB`定数）：
  - member: 社会情報インフラ部_第1ライン
  - threeSE: 3SEレポート提出状況サマリ
  - reportArchive: 📚 3SEレポート事例集
  - sales: 売上データ
  - info: インフォメーション
  - knowledge: ナレッジ・FAQ
  - meetingPlan: 実施計画（ライン別会議実施計画）
  - skill: 📍 スキルマップ
  - certification: 💯 保有資格
  - chronicle: 📖 ライン年表
- 対象ページ（DBクエリではなくページ本文のブロックを直接取得。`scripts/sync-notion.mjs`内`PAGE`定数）：
  - orgChart: 👥 組織構成ページ（ページ本文配下のファイル添付を再帰的に全取得 → org_chart.csv）
- 認証：NotionのInternal Integrationトークンを GitHub Secrets の `NOTION_TOKEN` に設定して使用
- `member_master.csv`の「画像」列は自動取得せず、既存CSVの値を氏名突き合わせで引き継ぐ（顔写真は引き続き手動管理）
- `3se_report.csv`の「備考」列は、メンバーマスタの「ステータス」が異動/退職の人を自動判定して埋める（手動記入不要になった）
- データベースIDや列構成を変更した場合は`scripts/sync-notion.mjs`と本セクションを更新すること
- 各データベースの取得・書き込みは`section()`ラッパーで個別にtry/catchしている。1つのDB（例：保有資格）でエラーが起きても他のDBの同期は止まらず、成功した分だけ書き込まれる。ワークフロー側もコミットステップに`if: ${{ !cancelled() }}`を付けており、同期スクリプトの一部が失敗して終了コード1になった場合でも、成功した分のコミット・pushは実行される
- `warnDuplicates()`により、同一人物×同一スキル（氏名＋スキル名＋サブカテゴリ）・同一人物×同一資格（氏名＋資格名）がNotion側で重複登録されている場合、ビルドを止めずGitHub Actionsのログに警告を出す（重複があると後の行が前の行を無言で上書きしてしまうため）

## フォールバック：手動バッチ運用
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

## メンテナンス切り替え
最速：`maintenance-app.html`（スマホのホーム画面に追加推奨）をワンタップ。GitHub自体に一切アクセスせず、その場で切り替え・数十秒後の反映確認まで完結する。初回のみGitHub PAT（このリポジトリのActions権限のみのfine-grained推奨）の設定が必要。詳細はmaintenance-app.htmlのセクションを参照

標準：GitHub Actions「メンテナンスモード切り替え」（`.github/workflows/maintenance.yml`）をGitHubのActionsタブから手動実行（workflow_dispatch）。gitコマンド不要、ブラウザから`mode`（on/off）を選んでRun workflowを押すだけ。`message`・`estimated`は空欄なら前回の内容を維持するので、offにするだけなら他の入力は不要
```
開始：Actionsタブ → メンテナンスモード切り替え → Run workflow → mode: on
復旧：Actionsタブ → メンテナンスモード切り替え → Run workflow → mode: off
```
フォールバック：手動でdata/maintenance.jsonのactiveを直接編集してgit push（従来通りの方法。ローカルにリポジトリがある場合はこちらでも可）

## 整合性チェック（scripts/check-consistency.mjs）

2026-11-08追加。複数ファイルに重複定義されている値や、全ページ共通の約束事が崩れていないかを機械的に照合するNodeスクリプト（依存なし）。`node scripts/check-consistency.mjs`で実行し、問題があれば一覧を出して終了コード1になる。

| チェック | 内容 |
|---------|------|
| 評価時期 | `config/org.json`の`skillPeriods`を正として、`skill.html`（`PERIODS`初期値・フォールバック値）・`portfolio.html`・`you-widget.js`・`scripts/sync-notion.mjs`のハードコード値が一致するか |
| `NEW_BADGE_DAYS` | `index.html`と`info.html`で同じ値か |
| nav.js | `NAV_ITEMS`の全項目に`mini`があり、リンク先ファイルが実在するか |
| 開発ドキュメント | 全`*.html`に`docs/dev/pages/<名前>.md`があり、ルートCLAUDE.mdが参照する`docs/dev/`のファイルが実在するか |
| robots / SRI | 全ページにnoindexのmetaがあり、外部`<script>`に`integrity`・`crossorigin`が付き、同じURLならページ間で同じintegrityか（ハッシュ値自体の正しさはネットワークが要るため見ていない） |
| you-widget | `you-widget.js`を読むページが`data.js`を先に読み、`#youMini`を持っているか |

- 判断が要る確認（ドキュメントの記述がコードと合っているか等）はこのスクリプトではなく、`docs-sync`サブエージェント（`.claude/agents/docs-sync.md`）が担当する。役割分担：**決まった値の照合＝スクリプト（無料・確実）、文章と実装の突き合わせ＝サブエージェント（Sonnetで実行しコストを抑える）**
- 変数名を変えるとスクリプトが「定義が見つからない」と報告するので、その場合はスクリプト側の正規表現も直すこと
