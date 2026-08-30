<!-- GENERATED from CLAUDE.md - do not edit directly. source-sha256: 8b69315364099b5552874829ca7a4c4a317068b6002faa96927e948544958aee -->
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
- **2026-08-30 に内容確認済み(問題なし)。** 再点検は Console 側で行う
- 新しい秘匿値(サーバ側 API キー等)を `VITE_` 変数として追加してはいけない

`.env.example` に変数名の雛形がある。

## 検証

```
npm run build
```
