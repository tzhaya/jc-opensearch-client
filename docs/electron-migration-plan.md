# Electron 移行計画: jc-opensearch-client

## Context

現在のプロジェクトは単一HTMLファイル（739行）として動作するブラウザ向けWebアプリ。
ブラウザのCORS制限を回避するためにCloudflare Workersをプロキシとして使用しており、GitHub Pagesで配信している。

**移行の動機と期待される効果：**
- **CORSプロキシ不要化**: Electronのメインプロセス（Node.js）がHTTPリクエストを直接実行するため、Cloudflare WorkersプロキシとそのSSRF対策ロジックが不要になる
- **ホスト制限の解除**: 現在はプロキシのホワイトリストに登録されたJAIRO Cloud機関のみ検索可能。Electron版では任意のWEKO3リポジトリにアクセスできる
- **配布のシンプル化**: GitHub Pages + Cloudflare Workers の2段構成が単一のデスクトップアプリに統合される
- **将来的な機能拡張**: ファイル保存、クリップボード操作、デスクトップ通知など

---

## 現在のアーキテクチャ

```
ブラウザ → GitHub Pages (index.html) → Cloudflare Workers (CORSプロキシ) → WEKO3 API
```

**主要ファイル：**
- `jc-opensearch.html` (739行) - HTML/CSS/JS一体型、唯一のソースファイル
- `.github/workflows/deploy.yml` - GitHub Pages デプロイ + PROXY_URL の sed 注入
- README.md にCloudflare Workersのコードが含まれる

---

## 移行方針: **最小変更アプローチ**

フルリファクタリング（React/Vue化、TypeScript化等）は**行わない**。
既存のVanilla JS HTMLを最大限活用し、Electronシェルを薄く被せる。

### 新アーキテクチャ

```
Electron (デスクトップアプリ)
├── Main Process (Node.js)
│   └── HTTP fetch を直接実行（CORS制限なし）
├── Preload Script
│   └── contextBridge で Renderer に安全なfetchAPIを公開
└── Renderer Process (Chromium)
    └── 既存HTML（最小変更）
```

---

## 作成・変更ファイル

### 新規作成

| ファイル | 内容 |
|---|---|
| `package.json` | Electron, electron-builder, npm scripts |
| `src/main.js` | Electronメインプロセス（ウィンドウ生成、IPC処理） |
| `src/preload.js` | contextBridge で `window.electronAPI.fetch` を公開 |
| `.github/workflows/build-electron.yml` | リリースビルドのCI/CD |

### 変更

| ファイル | 変更内容 |
|---|---|
| `src/renderer/index.html` | 既存HTMLをコピーして移植。proxyUrl削除、fetch呼び出しをElectron対応に変更 |

### 変更不要（Webバージョンは維持）

| ファイル | 理由 |
|---|---|
| `jc-opensearch.html` | GitHub Pages版として引き続きそのまま利用 |
| `.github/workflows/deploy.yml` | Webデプロイは維持 |

---

## 実装ステップ

### Step 1: package.json の作成

```json
{
  "name": "jc-opensearch-client",
  "version": "1.0.0",
  "main": "src/main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "dependencies": {
    "electron": "^latest"
  },
  "devDependencies": {
    "electron-builder": "^latest"
  },
  "build": {
    "appId": "jp.ac.nii.jc-opensearch-client",
    "productName": "JAIRO Cloud OpenSearch クライアント",
    "directories": { "output": "dist" },
    "files": ["src/**/*"],
    "win":   { "target": "nsis" },
    "mac":   { "target": "dmg"  },
    "linux": { "target": "AppImage" }
  }
}
```

### Step 2: src/main.js の作成

- `BrowserWindow` 生成（`nodeIntegration: false`, `contextIsolation: true`）
- `ipcMain.handle('fetch', ...)` でHTTPリクエストを受け取り、Node.jsの `fetch`（またはNode.js組み込みの`https`）で直接実行
- セキュリティ設定: `webSecurity: true`（CORSは**メインプロセス経由**で解決するため不要）

### Step 3: src/preload.js の作成

```javascript
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  fetch: (url, options) => ipcRenderer.invoke('fetch', url, options)
});
```

### Step 4: src/renderer/index.html の作成（既存HTMLを移植）

既存 `jc-opensearch.html` から以下を変更：

1. **CONFIG の proxyUrl を削除**（不要になる）
2. **fetch呼び出しを条件分岐**:
   ```javascript
   const apiFetch = window.electronAPI
     ? (url) => window.electronAPI.fetch(url)
     : (url) => fetch(url);
   ```
   これにより、Electron版・Web版の両方で動作するコードになる
3. CORS エラーメッセージの修正（Electronでは発生しないため）

### Step 5: .github/workflows/build-electron.yml の作成

- トリガー: タグプッシュ（`v*`）またはマニュアル実行
- Matrix: Windows, macOS, Linux の3プラットフォームでビルド
- GitHub Releases へのアップロード

---

## コスト・工数見積もり

| 作業 | 工数 |
|---|---|
| package.json + electron-builder設定 | 1時間 |
| src/main.js（メインプロセス + IPC） | 1〜2時間 |
| src/preload.js | 0.5時間 |
| src/renderer/index.html（HTML移植・修正） | 1時間 |
| GitHub Actions ビルドCI | 1〜2時間 |
| 動作確認・テスト | 2時間 |
| **合計** | **約6.5〜8.5時間** |

**リスク評価：低**
- アプリが非常にシンプル（Vanilla JS、依存なし）
- 変更箇所が限定的（fetchの呼び出し部分のみ）
- Web版とElectron版を並行維持できる設計

---

## 検証方法

1. `npm start` でElectronアプリが起動することを確認
2. Cloudflare WorkersプロキシなしでJAIRO Cloud機関リポジトリを検索できることを確認
3. `npm run build` で各プラットフォーム向けインストーラが生成されることを確認
4. 生成したインストーラをインストールして動作確認
5. 既存の `jc-opensearch.html`（GitHub Pages版）が引き続き動作することを確認

---

## 非対応範囲（今回スコープ外）

以下は今回の移行では実装しない：
- React/Vue等のフレームワーク導入
- TypeScript化
- テストの追加
- ファイル保存・エクスポート機能
- 自動アップデート機能
- システムトレイ常駐
