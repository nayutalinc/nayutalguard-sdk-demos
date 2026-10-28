<!-- en-source: ios/SDKDemo/README.md sha256:3b586e479a2bca846831e2b41f896f8a2ecb6b8a23c787e3339545394a6d5b5c -->
# NayutalGuard SDK — iOS デモ

English: [README.md](README.md)

> この日本語版は英語版（README.md）から翻訳したものです。英語版が正本です。コード、パス、バージョン、ハッシュ値、リンク先が英語版と同一であることを CI が検証しています。

SDK を組み込む一連の流れを示す最小限のホストアプリです。端末の情報を集め、SDK に渡し、検出結果を表示します。SwiftUI のファイル 1 つだけで構成しています。主役は組み込みであってアプリではありません。

このプロジェクトは**単独で**ビルドできます。お客様と同じ方法で、出荷済みの XCFramework を組み込んでいます。ここでビルドできるものは、お客様の環境でもビルドできます。

## 前提条件

- Xcode 16 以降（デプロイメントターゲットは iOS 16.0）
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) — `brew install xcodegen`

Xcode プロジェクトはコミットせず、`project.yml` から生成します。古い `.pbxproj` をマージする必要はありません。

## 1. SDK の成果物を入手する

`NayutalSDK-1.10.0.xcframework.zip` の入手先は次の 2 つのいずれかで、内容は同じバイト列です。

- 組み込みの際に Nayutal からお渡しした SDK パッケージ（通常はこちらです）
- **sdk-v1.10.0** の GitHub リリースのアセット。お客様の組み込みに `nayutalguard` リポジトリへのアクセスが含まれている場合に利用できます（このページは公開されていません）。

```text
https://github.com/nayutalinc/nayutalguard/releases/tag/sdk-v1.10.0
```

いずれの場合も、組み込む前に手順 2 で公開されているハッシュ値の一覧表と照合してください。

## 2. 使う前に検証する

リリースノートには成果物ごとに SHA-256 を掲載しています。ダウンロードしたファイルをそのページの値と照合してください。

```bash
shasum -a 256 NayutalSDK-1.10.0.xcframework.zip
```

`NayutalSDK-1.10.0.xcframework.zip` の期待値:

```text
8c58596f52faf1534d5a02ec79dfd214d20dc8900630413ff4f8767784d1d697
```

一致しない場合は作業を止めて、私たちにご連絡ください。その成果物に対してビルドしないでください。

## 3. 配置する

```bash
mkdir -p Frameworks
unzip NayutalSDK-1.10.0.xcframework.zip -d Frameworks/
```

`Frameworks/NayutalSDK.xcframework` ができていれば完了です。このパスは意図的に gitignore しています。成果物はダウンロードして検証するものであり、コミットするものではありません。

## 4. API キーを渡す

認証情報は gitignore 済みの `Secrets.xcconfig` に置きます。サンプルをコピーして値を入れてください。

```bash
cp Secrets.xcconfig.example Secrets.xcconfig
```

次に、この内容を編集します。

```xcconfig
NAYUTAL_BASE_URL = https:/$()/<base-url-you-received>/
NAYUTAL_API_KEY = your-key-here
```

URL の中の `$()` は誤植ではありません。Xcode が `//` をコメントの始まりとして読んでしまうのを防いでいます。値はビルド時に `Info.plist` に流し込まれ、起動時に読み取られるため、キーがソースコードに現れることはありません。

## 5. 生成、ビルド、実行

```bash
xcodegen generate
open SDKDemo.xcodeproj
```

シミュレーターを選んで Run を押してください。コマンドラインからは次のとおりです。

```bash
xcodegen generate
xcodebuild -project SDKDemo.xcodeproj -scheme SDKDemo \
  -destination 'generic/platform=iOS Simulator' build
```

特定のシミュレーター向けにビルドする場合は、機種を決め打ちせず、実際にある端末名を指定してください（`xcrun simctl list devices available`）。

```bash
xcodebuild -project SDKDemo.xcodeproj -scheme SDKDemo \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

**Run Scan** をタップしてください。結果ブロックの先頭には SDK が返したスキーマ（このリリースでは `schema 1.8.0`）が表示され、その後に検出機構ごとのセクションが続きます。iOS では証明書ストアの確認（D7）が `SKIPPED` と表示されます。プラットフォームが証明書ストアの列挙手段を提供していないためで、SDK は推測せずにその旨を報告します。

デモは現行 API のホスト側の使い方も示します。キーがない場合は `NayutalConfigurationError` として通知されてスキャンは実行されません。`feeds` は各フィードの状態を報告します。測定できなかった検出は状態と理由を表示します（サインインページの背後で保留された D2 は `captive_portal` を報告します）。`weak_key:<host>` のような `observations` は、深刻度を変えずにそのまま表示します。ホストの `SDKActiveVpnProbe` は `vpnReading()` を実装し、読み取りに失敗した場合は `.noVpn` ではなく `.unknown` を返します。

`DemoSdkConfig.swift` の SDK 設定には、1.8.0 で追加された 3 つの任意項目も明示しています。SDK の組み込みの値を指定した `dnsBaseline`、有効のままの `certificateCheck`、そしてベース URL への SDK の呼び出しに固定のテスト用ヘッダー `X-Demo-Client` を 1 つ追加する `requestHeaders` プロバイダーです。ネットワークのセクションには、各スキャンが使った DNS の基準が表示されます。基準を指定すると、項目を指定しない場合と 1 点だけ動作が異なります。指定したサーバーが端末自身の DNS サーバーである場合、そのスキャンではそのサーバーに問い合わせません。

デモが証明書チェックを無効にすることはありません。単体テスト（`SDKDemoTests` ターゲット）がそれを確認し、`certificateCheck` に `true` 以外を渡すデモのソースは CI が拒否します（`scripts/check-certificate-check.mjs`）。

```bash
xcodebuild -project SDKDemo.xcodeproj -scheme SDKDemo \
  -destination 'platform=iOS Simulator,name=iPhone 17' test
```

## 署名

`project.yml` では `DEVELOPMENT_TEAM` を空にしています。**シミュレーター**向けのビルドにはチームも署名用の証明書も不要なので、上記の手順はどの Mac でもそのまま動きます。**実機**で実行するには、`project.yml` の `DEVELOPMENT_TEAM` にお客様の Apple チーム ID を設定し、`xcodegen generate` をもう一度実行してください。Xcode がそのチームの開発用証明書でアプリに署名します。
