# 作業ログ

## 2026-02-24: インデックス（iid）絞り込み検索の追加

### 背景

- WEKO3 OpenSearch API の `iid` パラメータ（インデックスID）が有効に動作することを確認。
- 対象インデックスを絞り込んで検索できる機能を要望。

### 対応内容

**クライアント (jc-opensearch.html)**

| 追加内容 | 説明 |
|---|---|
| インデックス選択フィールド | 資源タイプの下に `<select id="q-iid">` と「取得」ボタンを追加 |
| `fetchIndexTree()` | リポジトリの `/api/tree` を呼び出し、インデックスツリーを取得してドロップダウンに表示 |
| `addTreeNodes()` | ツリーを再帰的にフラット化し、深さに応じてインデント（`\u00a0` 2個）を付与 |
| `buildUrl` | `query.iid` があれば URL パラメータに追加 |
| `doSearch` | `iid` を query オブジェクトに追加、検索条件チェックに `iid` を追加 |
| `init` | 「取得」ボタンクリック・リポジトリURL変更時のイベントリスナー追加、初期URL設定済みの場合は自動取得 |

**ツリー取得フロー**

1. ユーザーがリポジトリ URL を入力後、「取得」ボタンをクリック
2. `fetchIndexTree()` が `proxyUrl?repo=...&path=/api/tree` を呼び出し
3. WEKO3 `/api/tree` の JSON レスポンス（`id`, `value`, `children` の再帰構造）を解析
4. `addTreeNodes()` で `<option value="ID">インデックス名</option>` に変換

**Cloudflare Worker (README.md)**

| 追加内容 | 説明 |
|---|---|
| `path` パラメータ処理 | `path=/api/tree` の場合は `{repoUrl}/api/tree` にルーティング（追加パラメータ不可） |
| `iid` パラメータ検証 | `ALLOWED_PARAMS` に追加（正規表現 `/^\d{1,10}$/`） |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `jc-opensearch.html` | インデックスフィールド UI・fetchIndexTree 関数・iid 対応 |
| `README.md` | Worker コード更新（path モード・iid 検証追加）、変更履歴追記 |

## 2026-02-23: Worker クエリパラメータ許可リスト検証

### 背景

Cloudflare Workers プロキシが受け取ったクエリパラメータをそのまま上流 API へ転送しており、クライアントが意図しないパラメータ（不明なキー・不正な値）を注入できる状態だった。

### 対応内容

`ALLOWED_PARAMS` オブジェクトでキーと値を正規表現で検証し、1つでも条件を満たさないパラメータがあれば `400 Bad Request` を返す。

| パラメータ | 許可パターン |
|---|---|
| `format` | `jpcoar` のみ |
| `size` | 1〜100 の整数 |
| `page` | 1 以上の整数 |
| `title` | 200文字以内の文字列 |
| `des` | 200文字以内の文字列 |
| `type` | resource_type_vocabulary.md 掲載の 47 値のみ（完全一致） |
| 上記以外 | 一律ブロック |

`type` は `Set` による完全一致チェックを行い、ループは `rule instanceof Set ? rule.has(value) : rule.test(value)` で RegExp / Set 両対応。
`repo` はこの検証前に取り出し・削除済みのため対象外。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `README.md` | Worker コードを更新、変更履歴に追記 |
| `docs/worklog.md` | 本セクションを追記 |

---

## 2026-02-23: Worker セキュリティ強化（リダイレクト・スキーム・タイムアウト・CORS ヘッダー）

### 背景

Cloudflare Workers プロキシのコードレビューで以下のセキュリティ課題が指摘された。

### 対応内容

#### 1. リダイレクト追従禁止（高）

`fetch(targetUrl)` のデフォルト動作は 3xx リダイレクトを追従するため、許可済みホストから許可外ホストへのリダイレクトを経由した SSRF が可能だった。

- `fetch(targetUrl, { redirect: 'manual' })` を設定してリダイレクト追従を無効化
- `response.status >= 300 && response.status < 400` の場合は `502 Redirect not allowed` を返す
- `fetch` 例外を try/catch で捕捉して `502 Upstream request failed` を返す

#### 2. スキーム/ポート制限（中）

ホスト名のみ検証しており、`http://` URL や非標準ポート指定を防いでいなかった。

- `repoUrl.protocol !== 'https:'` の場合は `403 Forbidden` を返す
- `repoUrl.port !== ''` の場合（非標準ポート）も `403 Forbidden` を返す
- URL パースを `repoHost = new URL(repo).hostname` から `repoUrl = new URL(repo)` に変更して一括取得

#### 3. タイムアウト追加（中）

タイムアウト設定がなく、上流サーバーの遅延応答で Worker 実行時間が消費される問題があった。

- `signal: AbortSignal.timeout(10000)` で 10 秒タイムアウトを設定

#### 4. 不許可 Origin 時の CORS ヘッダー省略（低）

`corsOrigin = ''` として空文字の `Access-Control-Allow-Origin` を返していた。

- `corsOrigin = null` に変更し、`corsOrigin` が非 null の場合のみヘッダーを設定
- OPTIONS レスポンスも同様に変更（ヘッダーを object で組み立てて条件追加）

#### 5. CORS の限界をコメントで明示（中）

`ALLOWED_ORIGIN` の説明コメントに以下を追記:
> ※ CORS はブラウザ向けの制約であり、curl 等のサーバー間通信は防止できません。不正利用が懸念される場合は Cloudflare Access や Rate Limiting の利用を検討してください。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `README.md` | Worker コードを更新、変更履歴に追記 |
| `docs/worklog.md` | 本セクションを追記 |

---

## 2026-02-23: Worker の CORS を GitHub Pages オリジンのみに制限

### 背景

Cloudflare Workers プロキシが `Access-Control-Allow-Origin: *` を返していたため、Worker URL を知っていれば任意のオリジンからアクセスできる状態だった。

### 対応内容

- `ALLOWED_ORIGIN` 定数を追加し、許可するオリジンを1つに限定
- `Access-Control-Allow-Origin: *` を廃止し、リクエストの `Origin` ヘッダーが `ALLOWED_ORIGIN` と一致する場合のみそのオリジンを返すよう変更
- `Vary: Origin` ヘッダーを追加（CDN キャッシュが Origin 別に正しく保持されるよう）
- OPTIONS（プリフライト）レスポンスも同様に変更

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `README.md` | Worker コードを更新、変更履歴に追記 |
| `docs/requirements.md` | CORS 制限要件を追記 |
| `docs/worklog.md` | 本セクションを追記 |

---

## 2026-02-23: GitHub Actions による GitHub Pages デプロイを追加

### 対応内容

- GitHub Actions を使用して `jc-opensearch.html` から `index.html` を生成・デプロイする仕組みを追加
- `CONFIG.proxyUrl` の値は GitHub Secrets（`PROXY_URL`）から注入し、リポジトリには記録しない
- `index.html` は `.gitignore` に追加（デプロイ時のみ生成）
- エラーメッセージを公開用に簡略化（CORS 手動解除の案内を削除）
- `jc-opensearch.html` はテンプレート版として CONFIG 空白のまま維持

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `.github/workflows/deploy.yml` | 新規作成（GitHub Actions デプロイ） |
| `.gitignore` | `index.html` を追加 |
| `README.md` | 使い方・ファイル構成・変更履歴を更新 |
| `docs/worklog.md` | 本セクションを追記 |

---

## 2026-02-23: ALLOWED_HOST を JAIRO Cloud 利用機関リストに基づいて更新

### 背景

Cloudflare Workers プロキシの SSRF 対策として設定していた `ALLOWED_HOST` が `*.repo.nii.ac.jp` の正規表現のみであったため、JAIRO Cloud 利用機関のうち独自ドメインを持つ機関（東京大学・お茶の水女子大学・総研大等）が利用できない問題があった。また、正規表現が広すぎて `*.repo.nii.ac.jp` であれば任意のホストへ転送できる状態であった。

### 対応内容

#### 利用機関リストの調査

JAIRO Cloud 利用機関一覧スプレッドシートの「リポジトリURL（JAIRO Cloud利用機関のみ）」列を参照し、以下の分類を確認した。

- 大多数（約800機関）: `*.repo.nii.ac.jp` ドメイン → 正規表現で一括許可を維持
- 少数（18機関）: 独自ドメイン → `Set` で個別に列挙して追加

#### 独自ドメイン一覧（18件）

| ホスト | 機関 |
|---|---|
| `repository.nii.ac.jp` | 国立情報学研究所 |
| `d-repo.ier.hit-u.ac.jp` | 一橋大学 |
| `repository.lib.tottori-u.ac.jp` | 鳥取大学 |
| `ismrepo.ism.ac.jp` | 統計数理研究所 |
| `repository.ninjal.ac.jp` | 国立国語研究所 |
| `ir.soken.ac.jp` | 総合研究大学院大学 |
| `repository.dl.itc.u-tokyo.ac.jp` | 東京大学 |
| `teapot.lib.ocha.ac.jp` | お茶の水女子大学 |
| `kutarr.kochi-tech.ac.jp` | 高知工科大学 |
| `ir.jikei.ac.jp` | 慈恵医科大学 |
| `ir.kagoshima-u.ac.jp` | 鹿児島大学 |
| `amcor.asahikawa-med.ac.jp` | 旭川医科大学 |
| `repository.ffpri.go.jp` | 森林総合研究所 |
| `repository.jircas.go.jp` | 国際農林水産業研究センター |
| `repository.naro.go.jp` | 農業・食品産業技術総合研究機構 |
| `ir.ide.go.jp` | アジア経済研究所 |
| `repo.qst.go.jp` | 量子科学技術研究開発機構 |
| `repo-tkfd.jp` | 東京財団政策研究所 |

#### Worker コードの変更

`README.md` に記載の Cloudflare Worker コードを以下のように変更した。

- `const ALLOWED_HOST = /\.repo\.nii\.ac\.jp$/` を削除
- `ALLOWED_HOST_PATTERN = /\.repo\.nii\.ac\.jp$/i`（`/i` フラグで大文字小文字を区別しない）を追加
- `ALLOWED_HOSTS_EXTRA`（18件の独自ドメインの Set）を追加
- ホスト検証ロジックを `ALLOWED_HOST_PATTERN.test(repoHost) || ALLOWED_HOSTS_EXTRA.has(repoHost)` に変更
- `hostname.toLowerCase()` で正規化してから比較するよう変更
- URL パース失敗時に `400 Invalid repo URL` を返す防御コードを追加

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `README.md` | Worker コードを更新、変更履歴に追記 |
| `docs/requirements.md` | Cloudflare Workers プロキシ要件セクションを追加 |
| `docs/worklog.md` | 本ファイルを新規作成 |

---

## 2026-02-23: Cloudflare Workers プロキシ対応

### 背景

静的 HTML をブラウザで開いた場合、JAIRO Cloud API への直接リクエストが CORS によりブロックされる問題があった。

### 対応内容

- Cloudflare Workers をプロキシとして利用する仕組みを追加
- `CONFIG.proxyUrl` に Worker URL を設定することでプロキシ経由のリクエストに切り替わる
- SSRF 対策として転送先を `*.repo.nii.ac.jp` に限定

---

## 2026-02-22: 初版リリース

- `jc-opensearch.html` の初版を作成
- タイトル・内容記述・資源タイプによる検索機能を実装
- JPCOAR XML パース・書誌情報表示・ページング機能を実装
