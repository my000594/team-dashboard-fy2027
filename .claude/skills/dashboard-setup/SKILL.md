---
name: dashboard-setup
description: このダッシュボードを別の部署・組織向けに立ち上げる初期セットアップを、ヒアリング→設定ファイルの書き換え→外部サービス（Notion・GitHub・Cloudflare）の設定案内→動作確認の順に対話で進める。ダッシュボード一式を受け取った側が最初に一度だけ使う。
disable-model-invocation: true
---

# ダッシュボード初期セットアップ

受け取った人（以下「導入者」）と対話しながら、このダッシュボードを導入者の組織用に立ち上げる。導入者はエンジニアとは限らない前提で、専門用語には一言説明を添え、**1ステップずつ**進める（全手順を一度に見せない）。

## 進め方の原則

- 各ステップの最初に「このステップでやること」を1〜2行で伝え、終わったら次へ進んでよいか確認する
- **コードやファイルの書き換えはあなたが行う**。導入者に手で編集させるのは、ブラウザでしかできない外部サービスの設定（Notion・GitHub・Cloudflareの画面操作）だけ
- 外部サービスの画面は変わることがあるので、案内は「どこで・何を設定するか」を中心にし、ボタン位置を断定しすぎない。導入者が迷ったらスクリーンショットを貼ってもらう
- トークン・PAT・メールアドレス一覧などの秘密情報は、**チャットに貼らせない**。GitHub Secrets・Cloudflareの画面に直接入力してもらう
- 変更のたびに git commit する（コミットメッセージは日本語で何をしたか）。push は Step 6 でリポジトリをつないでから

## Step 0：前提の確認

次を確認し、足りなければ先に用意してもらう。

1. 受け取ったファイルが **git履歴を含まない状態**か（`git log` が渡す側の履歴を持っていたら、そのまま使わない。過去のコミットに元組織のメンバー情報が残っているため。`.git` を消して `git init` からやり直すよう案内する）
2. アカウント：GitHub・Cloudflare（無料枠で可）・Notion（各DBを置くワークスペース）
3. Node.js が入っているか（`node -v`。整合性チェックに使う）

## Step 1：ヒアリング

以下を**まとめて1回で**聞く（AskUserQuestion か箇条書きの質問）。不明なものは後で決めてよいと伝える。

| 項目 | 反映先 |
|------|--------|
| 組織名の表記（サイドバー用の短い名前、例：「〇〇部 第2課」） | `config/org.json` の `orgLabel`、各ページの `<title>` 等 |
| 年度・期の表記（例：「FY2027 Dashboard」）と期の開始月 | `orgLabel`/`fyLabel`、chronicle.html の `fyOf()`（8月始まり前提） |
| ライン（チーム）構成：名前・責任者・表示色 | `lines` |
| Notion側の「所属ライン」の書き方が組織上の名前と違う場合の対応表 | `lineLabelMap` |
| 参考値だけ登録するメンバー（上長など）がいるか | `referenceMembers` |
| スキル評価を行う時期（例：年4回） | `skillPeriods` ほか計5箇所 |
| 使うページ（下記） | `nav.js` の `NAV_ITEMS`・不要ページの削除 |
| ナレッジの👍投票を使うか | Step 7 の D1 設定の要否 |

**ページの選択**：
- **コア（設定だけで動く）**：トップ・インフォメーション・メンバー・ナレッジ・スキルマップ・個人ポートフォリオ
- **参考実装（元組織の制度に依存。そのままでは使えない）**：3SEレポート・売上・会議計画・キャリアロードマップ・ライン年表。`docs/PATTERNS.md` を読んで、各ページが「何の型の見本か」を導入者に説明し、①使わない（削除）②自組織向けに作り直す（このセットアップ後に別作業）のどちらかを選んでもらう

## Step 2：設定ファイルとコードの組織固有値を書き換える

1. `config/org.json` をヒアリング結果で書き換える
2. 評価時期は `config/org.json` 以外にもハードコードがあるので揃える：`skill.html`（`PERIODS` 初期値とフォールバック値）・`portfolio.html`・`you-widget.js`・`scripts/sync-notion.mjs`
3. `org.json` で賄えない表記を置き換える。`Grep` で元組織の名前（組織名・ライン名・年度表記）を全 `*.html`・`*.js` から探し、`<title>`・ページ見出し・サイドバーのロゴなどを書き換える。コメント内の記述は書き換えなくてよい
4. `maintenance-app.html` の `OWNER`・`REPO` を導入者の GitHub アカウント名・リポジトリ名にする（Step 6 で決まってから戻ってきてもよい）
5. 使わないページを削除し、`nav.js` の `NAV_ITEMS`・`docs/dev/pages/<ページ名>.md`・ルート `CLAUDE.md` のファイル構成と索引からも外す。削除したページのCSVを読む処理が `scripts/sync-notion.mjs` にあれば、その `section()` と `DB` 定数の行も消す
6. `node scripts/check-consistency.mjs` を実行し、OKになるまで直す

## Step 3：サンプルデータの片付け

1. `data/` 配下のCSVは元組織の実データなので、**ヘッダー行だけ残して中身を空にする**（列構成は `data/CLAUDE.md` 参照）。`data/members/*.png`（顔写真）と `data/knowledge_images/` の中身は削除する
2. ルート `CLAUDE.md` の「組織構成」節（元組織のメンバー一覧）と、`docs/` 配下のマニュアルにある元組織固有の記述を、導入者の組織の内容に置き換えるか、プレースホルダーにする
3. `Grep` で元組織のメンバーの氏名が残っていないか最終確認する（`config/org.json` の `referenceMembers` 等、Step 2 で導入者の値に置き換えたものは除く）

## Step 4：Notion のデータベースを用意する

1. `scripts/sync-notion.mjs` の `DB`・`PAGE` 定数と、各 `assertProperties(...)` 呼び出しを読み、**必要なDBとプロパティ名の一覧**を表にして導入者に見せる（プロパティの型は `data/CLAUDE.md` を参照）。プロパティ名は1文字でも違うと同期が止まることを伝える
2. 導入者にNotionでDBを作ってもらい、各DBのURLを貼ってもらう。URL中の32桁のIDを取り出して `DB`・`PAGE` 定数を書き換える（IDそのものは秘密情報ではない）
3. Notion の「インテグレーション（Internal Integration）」を作り、各DBにそのインテグレーションを共有（「接続」）してもらう。トークンはこの時点ではどこにも貼らず、Step 6 でGitHub Secretsに直接入れてもらう
4. 動作確認用に、メンバーDBに1〜2人分のテストデータを入れてもらう

## Step 5：ローカルでの表示確認

CSVを`fetch`で読むため、HTMLファイルをダブルクリックで開く（`file://`）と動かない。導入者の環境で使える静的サーバー（`npx --yes serve .` など）をリポジトリのルートで起動し、表示されたURLでトップページを開いてもらう。空データでもエラーにならず表示されることを確認する（Notion同期前なのでデータは空でよい）。

## Step 6：GitHub

1. 導入者の GitHub に**非公開（Private）リポジトリ**を作ってもらい、`git remote add origin` → `git push -u origin main`
2. リポジトリの Settings → Secrets and variables → Actions に `NOTION_TOKEN`（Step 4 のインテグレーションのトークン）を登録してもらう
3. Actions タブ →「Notionからデータ同期」→ Run workflow で手動実行してもらい、成功したら `git pull` して `data/` のCSVにテストデータが入ったことを確認する。失敗したらログを貼ってもらい原因を調べる（多いのはプロパティ名の不一致とDBの共有漏れ）
4. 定期実行の時刻（`.github/workflows/sync-notion.yml` の `cron`。UTC表記）を導入者の希望に合わせる

## Step 7：Cloudflare（公開と認証）

1. **Pages**：Workers & Pages → Create → Pages → GitHubのリポジトリを接続。ビルドコマンドは**空欄**、出力ディレクトリは `/`（ルート）。npmパッケージは使わない設計なので、ビルドコマンドを足さないよう念押しする
2. **Access（ログイン制限）**：公開前に必ず設定する。Zero Trust で、Pagesのドメイン全体を対象にした Application を作り、Allow ポリシーに閲覧者のメールアドレスを登録、ログイン方式は One-time PIN。**Identity providers に One-time PIN を明示的に追加する**（未登録だと「no login methods available」エラーになる）。プレビュー用URL（`*.<プロジェクト名>.pages.dev`）も対象に含めるよう案内する
3. **👍投票を使う場合のみ**：`docs/admin_manual.md` の「7-2. DBを一から作り直す場合」の手順でD1作成・バインド（変数名 `DB`）・環境変数 `TEAM_DOMAIN`・`POLICY_AUD` を設定。使わない場合は `functions/` を残したままでよい（APIが失敗してもナレッジ本体は表示され、👍ボタンが出ないだけ）
4. 公開URLを開き、ログイン画面→ワンタイムコード→ダッシュボード表示まで通ることを確認してもらう

## Step 8：仕上げ

1. メンテナンス切替アプリを使う場合：`maintenance-app.html` の案内に沿って、このリポジトリだけ・Actions権限だけの fine-grained PAT を作り、スマホのブラウザでアプリに入力してもらう
2. ルート `CLAUDE.md` の冒頭（何のアプリか・公開URL・組織構成）と「今後の課題」を導入者の状況に書き換える
3. `node scripts/check-consistency.mjs` を実行してOKを確認し、commit・push
4. 最後に、導入者が今後やること（Notionでデータを更新すれば翌朝反映される、メンバーの増減時はAccessの許可リストも直す、等）を5行以内でまとめて伝え、詳細は `docs/admin_manual.md` を案内する
