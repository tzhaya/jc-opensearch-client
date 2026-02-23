# プロジェクト共通ルール

## ユーザー設定
- 日付の記録はすべて **日本標準時（JST / UTC+9）** を使用
- `gh` コマンドが見つからない場合はフルパス `"/c/Program Files/GitHub CLI/gh.exe"` で実行

## ワークフロー
- 作業完了時はコミットではなく **pull request の作成** を促すこと
- PR作成前に必ず以下を更新すること:
  - `README.md`: 変更履歴テーブルに日付と内容を追記（新しい日付が上）
  - `docs/requirements.md`: 機能追加・変更があれば要件定義を更新
  - `docs/worklog.md`: 最終更新日・実装内容の詳細セクションを追記
  - `MEMORY.md`: 行番号目安・ファイル規模など該当箇所を更新

## ブランチ運用ルール
- **基本的にすべての変更でブランチを作成する**（PRワークフローのため）
- ブランチ命名規則:
  - 新機能: `feature/機能名`
  - バグ修正: `fix/修正内容`
- 作業の流れ:
  1. `git checkout -b feature/xxx` — ブランチ作成
  2. 作業・コミット
  3. `gh pr create` — PR作成
  4. レビュー・マージ
  5. `git checkout master && git pull` — master同期
  6. `git branch -d feature/xxx` — ローカルブランチ削除
  7. 必要に応じてリモートブランチも削除
- マージ済みブランチは速やかに削除し、散らかりを防ぐ
