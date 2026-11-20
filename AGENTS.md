# VRChatEventManagement

VRChat イベントの管理アプリ。React + Vite + Firebase。

## 構成

- `src/` — アプリ本体
- Firebase (Auth / Firestore / Storage) を利用

## 環境変数

`.env` に置くのは `VITE_FIREBASE_*` の6変数のみ。

**これらは秘匿情報ではない。** `VITE_` プレフィックスの変数は Vite がビルド時に
クライアントバンドルへ埋め込むため、設計上ブラウザから可視である。
実際のアクセス制御は **Firebase Security Rules** が担う。

- ルールの妥当性がこのアプリの唯一のアクセス制御になる
- 新しい秘匿値(サーバ側 API キー等)を `VITE_` 変数として追加してはいけない

`.env.example` に変数名の雛形がある。

## Security Rules

**2026-09-15 から `firestore.rules` としてこのリポジトリで版管理する。**
それ以前は Firebase Console 側だけで管理されていた(現行内容は Console から
ダウンロードしたものが出発点)。

- **正本はリポジトリの `firestore.rules`。** Console のエディタで直接編集すると
  次回デプロイで失われる。変更は必ずこのファイル側へ
- 全コレクションが `isAuth()`(認証済みユーザー)で read/write を許可する構成。
  ロール分けはしていない
- コレクションを新設したら、このファイルに `match` ブロックを追加してデプロイ
  するまで読み書きが拒否される
- `firestore.indexes.json` も同様に版管理。現時点で複合インデックスは無い

デプロイ:
```
firebase deploy --only firestore:rules --project vrchateventmanagement
```

内容を変えずに Console の現行ルールを取り直したいときは `firebase init firestore`
(対話式。既存ルールをダウンロードして上書き確認してくる)。

## 検証

```
npm run build
npx playwright test
```
