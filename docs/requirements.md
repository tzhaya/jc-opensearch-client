# `JAIRO Cloud OpenSearch クライアント` 作成要件

## ファイル構成

| ファイル | 説明 |
|---|---|
| `jc-opensearch.html` | メインの OpenSearch 検索クライアント |

## このツールの目的

- このドキュメントは、`JAIRO Cloud OpenSearch クライアント` を作成するための要件を記述します。
- 本ツールは、JAIRO Cloudで構築された各機関リポジトリに対してOpenSeaach により検索を実行し、その結果を表示します。

## 技術詳細と依存関係

**フロントエンド技術**:
    - HTML5, CSS3, JavaScript

**外部API仕様**:
    -   WEKO3 OpenSearch API (`https://github.com/RCOSDP/weko-document/blob/main/docs/spec/base/api/API_03_OpenSearch.md`)

**資源タイプ語彙別表**
    -　`resource_type_vocabulary.md`

**JPCOARスキーマ 定義**
    - `https://github.com/JPCOAR/schema/blob/master/1.0/jpcoar_scm.xsd`

## 主要機能

-   **検索対象機関リポジトリの設定**:
    -   検索対象の機関リポジトリのURLを入力窓及びHTMLファイルのCONFIGセクションで設定できます。
    -   CONFIGセクションに設定がある場合でも、入力窓で設定したURLが優先されます。
        -   例： `https://jircas.repo.nii.ac.jp/`

-   **検索キーワードの入力**
    - 検索キーワードとして以下を使用します。

| クエリパラメータ | 表示名 | 説明 |
|---|---|---|
| title | タイトル | アイテムのタイトル |
| des | 内容記述 | アイテムの内容記述 |
| type | 資源タイプ | アイテムの資源タイプ 詳細は 資源タイプ語彙別表 の通り |

    - 以下はWEKO3 OpenSearch APIの記述にはあるが現時点で動作していない。このため実装から除外する。

| クエリパラメータ | 表示名 | 説明 |
|---|---|---|
| wid | アイテムID | アイテムのシステム上のID |
| lid | インデックスID | アイテムが属するインデックスID。 |

-   **レスポンス件数**
    -   20件とします。
    -   ヒット件数が21件以上の場合は、ページングして表示します。

-   **取得するデータ**
    -   フォーマットは `format=JPCOAR` として、JPCOARスキーマのXMLデータを取得します。
    -   取得件数は20件とします。
    -   ヒット件数が21件以上の場合は、ページングして表示します。

## Cloudflare Workers プロキシ要件

- CORS 問題を回避するため、Cloudflare Workers をプロキシとして使用する
- **SSRF 対策**: プロキシが転送できる接続先ホストを JAIRO Cloud 利用機関のリストに限定する
  - `*.repo.nii.ac.jp` は正規表現で一括許可（大文字小文字を区別しない）
  - それ以外の機関（東京大学・国立情報学研究所等）は Set で個別に列挙して許可
  - 利用機関リストの出典: [JAIRO Cloud 利用機関一覧スプレッドシート](https://docs.google.com/spreadsheets/d/1oNjykAjC2uvTV0KdUHflOwOq0Y7tMSqc10GivORNFMc/)
  - リスト外のホストへのリクエストは HTTP 403 を返す
- プロキシ URL は `jc-opensearch.html` の `CONFIG.proxyUrl` に設定する
- **CORS 制限**: `Access-Control-Allow-Origin` は `*` を使用せず、`ALLOWED_ORIGIN` に設定した特定オリジンのみ許可する
  - `ALLOWED_ORIGIN` には Worker を利用するページのオリジン（例: `https://<username>.github.io`）を設定する
  - `Vary: Origin` を付与してキャッシュ動作を正しく制御する

### HTMLテーブル の実装要件

- 以下の情報を一覧表示する。
  - タイトル
  - タイトルの次行にタイトルと同じ言語の`作成者氏名` をセミコロン区切り、スペースを空けて `収録物名` `巻`(`号`),　`開始ページ`-`終了ページ`, `日付(issued)`
    - `作成者氏名`は以下の順で生成
      - `creatorName`（`xml:lang` がタイトルと同じ言語のもの）があればそのまま使用
      - `creatorName` がない場合は `familyName`, `givenName` を結合して使用
      - 言語属性がない場合は最初に出現した要素を使用
    - 上記すべてにあてはまらない場合は空欄
  - 次行にファイルダウンロードリンク: `jpcoar:file` の `dc:title` をラベルとして表示し、`jpcoar:uri` をリンク先とする
  - 次行にアイテムのURL
- タイトルのクリックで、上記以外の各フィールドを展開して表示する。
- 表示様式は CiNii Researchの検索結果一覧表示およびJAIRO Cloud インポート用TSV生成ツール(β)
の入力画面を参考とする
  - 例：`https://cir.nii.ac.jp/articles?title=rice`
  - 例：`https://github.com/tzhaya/jc-import-file-maker`
