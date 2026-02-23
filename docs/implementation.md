# 実装計画: jc-opensearch-client

最終更新: 2026-02-22

## 概要

JAIRO Cloud 機関リポジトリ向け OpenSearch クライアント（`jc-opensearch.html`）を作成する。単一の HTML ファイルとして完結し、外部ライブラリ不使用。

---

## 作成ファイル

| ファイル | 説明 |
|---|---|
| `jc-opensearch.html` | メインの OpenSearch 検索クライアント |

---

## Step 1: 基本構造・設定・検索フォーム

### CONFIG セクション

```javascript
// ===== CONFIG =====
const CONFIG = {
  repositoryUrl: "https://jircas.repo.nii.ac.jp/"
};
// ==================
```

入力窓で設定した URL が CONFIG より優先される。

### 検索フォーム

| クエリパラメータ | ラベル | UI 部品 | 備考 |
|---|---|---|---|
| title | タイトル | テキスト入力 | |
| des | 内容記述 | テキスト入力 | |
| type | 資源タイプ | `<select>` | resource_type_vocabulary.md の値を使用 |

`wid`・`lid` は API 未対応のため実装しない。

### 完了条件

- フォームが表示される
- CONFIG の URL がデフォルト値として反映される

---

## Step 2: OpenSearch API 呼び出し・XML パース

### 参照仕様

- WEKO3 OpenSearch API: `https://github.com/RCOSDP/weko-document/blob/main/docs/spec/base/api/API_03_OpenSearch.md`
- JPCOAR スキーマ: `https://github.com/JPCOAR/schema/blob/master/1.0/jpcoar_scm.xsd`

### クエリ URL 構築

```
{repositoryUrl}api/opensearch/search?title={title}&des={des}&type={type}&format=jpcoar&size=20&page={page}
```

> **注意**: `format=jpcoar`（小文字）で動作確認済み。要件記載の `JPCOAR`（大文字）では HTML が返る。

### 処理フロー

1. フォーム入力値からクエリ URL を構築
2. `fetch()` で OpenSearch API を呼び出す
3. `DOMParser` で JPCOAR XML をパース
4. 以下の要素を抽出：

| JPCOAR 要素 | 用途 |
|---|---|
| `dc:title` | タイトル（`xml:lang` を保持） |
| `jpcoar:creatorName` | 作成者氏名（`xml:lang` を保持） |
| `jpcoar:familyName` / `jpcoar:givenName` | 氏名フォールバック用 |
| `jpcoar:sourceTitle` | 収録物名 |
| `jpcoar:volume` / `jpcoar:issue` | 巻・号 |
| `jpcoar:pageStart` / `jpcoar:pageEnd` | 開始・終了ページ |
| `dcterms:issued` | 発行日 |
| `jpcoar:file > dc:title` | ファイルラベル |
| `jpcoar:file > jpcoar:uri` | ファイル URL |
| `jpcoar:identifier` | アイテム URL |
| その他 JPCOAR フィールド全般 | 展開表示用 |

5. ページング状態（totalResults・現在ページ）を保持

### 完了条件

- 検索結果の XML が正常に取得・パースされる
- ページ切替で異なる結果が取得できる

---

## Step 3: 結果表示・ページング・スタイル

### 一覧表示（各アイテム）

各アイテムを以下の構成で表示する：

```
[タイトル（クリックで展開）]
作成者A; 作成者B  収録物名 巻(号), 開始-終了ページ, 発行日
[ファイルラベル](ファイルURL)  [ファイルラベル2](ファイルURL2) ...
https://アイテムURL
```

#### 作成者氏名の生成ロジック

1. タイトルの `xml:lang` 値（例: `ja`）を取得
2. 各 `jpcoar:creator` について：
   - `xml:lang` がタイトルと一致する `creatorName` があれば使用
   - なければ `xml:lang` 属性なしの `creatorName` を使用（最初の出現）
   - `creatorName` 自体がなければ `familyName` + `givenName` を結合
3. 複数の作成者はセミコロン（`; `）区切りで連結

#### 書誌情報の組み立て

- `収録物名 巻(号), 開始ページ-終了ページ, 発行日` の形式
- 存在する要素のみ出力（欠損項目はスキップ）

### 詳細展開表示

タイトルクリックで、一覧表示以外の全 JPCOAR フィールドを展開表示：
- ラベル | 値 形式のテーブル
- `jpcoar:identifier` は外部リンク（`<a target="_blank">`）
- 参考スタイル: `https://cir.nii.ac.jp/articles?title=rice`

### ページングコントロール

- 「前へ」「次へ」ボタン
- 現在ページ / 総ページ数表示

### スタイル方針

- 外部ライブラリ不使用（完全スタンドアロン）
- CiNii Research を参考にしたシンプルなリスト表示
- 日本語フォント（sans-serif）

### 完了条件

- 検索結果が一覧表示される
- 作成者氏名・書誌情報が正しく組み立てられる
- タイトルクリックで全フィールドが展開される
- ページングが正常に動作する
