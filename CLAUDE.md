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

- Security Rules はこのリポジトリに無く、Firebase Console 側で管理されている
- したがってルールの妥当性がこのアプリの唯一のアクセス制御になる
- 新しい秘匿値(サーバ側 API キー等)を `VITE_` 変数として追加してはいけない

`.env.example` に変数名の雛形がある。

## 検証

```
npm run build
```
