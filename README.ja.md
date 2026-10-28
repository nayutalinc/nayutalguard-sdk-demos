<!-- en-source: README.md sha256:f1e4d2a876853fd6dd6aec8e3a5ba6883d84d4cddbe4f499402698fa1767929b -->
# NayutalGuard SDK — デモホスト

English: [README.md](README.md)

> この日本語版は英語版（README.md）から翻訳したものです。英語版が正本です。コード、パス、バージョン、ハッシュ値、リンク先が英語版と同一であることを CI が検証しています。

NayutalGuard SDK を組み込んだ最小限のホストアプリケーションを、プラットフォームごとに 1 つずつ用意しています。いずれも画面は 1 つ（スキャンボタンと、順次届く結果の表示）で、組み込みの全体像を示します。成果物を組み込む、ビルド時に認証情報を注入する、スキャンを実行する、イベントストリームを受け取る、という流れです。

どちらのデモも **SDK 1.9.0** に対してビルドし、結果は **スキーマ 1.8.0** で表示します。

現行 API のホスト側の使い方（初期化の失敗、フィードの状態、測定できなかった理由、observations、1.8.0 で追加された任意の設定項目：DNS の基準、有効のままの証明書チェック、リクエストヘッダープロバイダー）も示します。

| デモ | プラットフォーム | 組み込む成果物 |
|---|---|---|
| [`android/demo`](android/demo/) | Android（Kotlin） | `libs/` に置いた `nayutal-sdk-1.9.0.aar` |
| [`ios/SDKDemo`](ios/SDKDemo/) | iOS（Swift、XcodeGen） | `Frameworks/` に置いた `NayutalSDK.xcframework` |

## 成果物

SDK パッケージは Nayutal からお客様にお渡しします。組み込む前に、受け取った成果物を公開されているハッシュ値と照合してください。1.9.0 の値は次のとおりです。

| 成果物 | SHA-256 |
|---|---|
| `nayutal-sdk-1.9.0.aar` | `52e6ebcd455f0fe5744697d0d8527694926bbd0e487b1620989b3e2993fc01d4` |
| `NayutalSDK-1.9.0.xcframework.zip` | `0cfaf77c7e444747622480bd23d8dc5c5ce247ede8941dea90816db041e5d4af` |

```bash
shasum -a 256 nayutal-sdk-1.9.0.aar NayutalSDK-1.9.0.xcframework.zip
```

各リリースの同じ一覧表は次のページで公開しています。
**https://docs.nayutalguard.com/ja/release-notes/**

組み込みに関する全体のドキュメント: **https://docs.nayutalguard.com/ja/**

## 次に読むもの

各デモの README に、前提条件、成果物の配置、ハッシュ値の検証、認証情報の注入、実行手順を記載しています。

- Android: [android/demo/README.ja.md](android/demo/README.ja.md)
- iOS: [ios/SDKDemo/README.ja.md](ios/SDKDemo/README.ja.md)

認証情報（ベース URL と API キー）は成果物とは別にお渡しし、リポジトリには決してコミットしません。どちらのデモもビルド時に注入します。

## 証明書チェックは有効のまま

どちらのデモも SDK の証明書チェックを無効にしません。各デモの単体テストが、設定の `certificateCheck` が true であることを確認します。また push と pull request のたびに、`certificateCheck` に `true` 以外を渡すデモのソースを `scripts/check-certificate-check.mjs` が拒否します。

## 2 つの言語を揃えておく仕組み

`README.ja.md` はこのファイルの日本語版です。日本語版のコードブロック、バージョン、ハッシュ値、リンク先は、push と pull request のたびに英語版と照合されます（`scripts/check-readme-drift.mjs`）。また日本語版には、翻訳元となった英語版の正確な版を示すピンが含まれています。英語版 README の変更は、日本語版の変更と同じコミットで行います。
