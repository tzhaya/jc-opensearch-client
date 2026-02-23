# 作業ログ

## 2026-02-23: ALLOWED_HOST を JAIRO Cloud 利用機関リストに基づいて更新

### 背景

Cloudflare Workers プロキシの SSRF 対策として設定していた `ALLOWED_HOST` が `*.repo.nii.ac.jp` の正規表現のみであったため、JAIRO Cloud 利用機関のうち非標準ドメインを持つ機関（東京大学・お茶の水女子大学・総研大等）が利用できない問題があった。また、正規表現が広すぎて `*.repo.nii.ac.jp` であれば任意のホストへ転送できる状態であった。

### 対応内容

#### 利用機関リストの調査

JAIRO Cloud 利用機関一覧スプレッドシートの「リポジトリURL（JAIRO Cloud利用機関のみ）」列を参照し、以下の分類を確認した。

- 大多数（約800機関）: `*.repo.nii.ac.jp` ドメイン → 正規表現で一括許可を維持
- 少数（18機関）: 非標準ドメイン → `Set` で個別に列挙して追加

#### 非標準ドメイン一覧（18件）

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
- `ALLOWED_HOSTS_EXTRA`（18件の非標準ドメインの Set）を追加
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
