<!-- en-source: ios/SDKDemo/README.md sha256:a8ef6399d96e5c898ada9e83c9f7d1258fa0574c51700908d330471d67ad0ce4 -->
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

**sdk-v1.4.2** のリリースノートページから `NayutalSDK-1.4.2.xcframework.zip` をダウンロードしてください。

```text
https://docs.nayutalguard.com/release-notes/
```

（SDK パッケージ自体は Nayutal からお客様にお渡しします。組み込む前に、成果物のハッシュ値をこのページと照合してください）

SDK をリポジトリ経由ではなく別の方法（配布リンクなど）で受け取った場合は、その配布物の成果物とチェックサムを使ってください。内容は同じバイト列です。

## 2. 使う前に検証する

リリースノートには成果物ごとに SHA-256 を掲載しています。ダウンロードしたファイルをそのページの値と照合してください。

```bash
shasum -a 256 NayutalSDK-1.4.2.xcframework.zip
```

`NayutalSDK-1.4.2.xcframework.zip` の期待値:

```text
8c9d0321fd825c1e58d5304e3c67946058f6c4a3108f84dc1123052c5a23edbc
```

一致しない場合は作業を止めて、私たちにご連絡ください。その成果物に対してビルドしないでください。

## 3. 配置する

```bash
mkdir -p Frameworks
unzip NayutalSDK-1.4.2.xcframework.zip -d Frameworks/
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

**Run Scan** をタップしてください。結果ブロックの先頭には SDK が返したスキーマ（このリリースでは `schema 1.4.0`）が表示され、その後に検出機構ごとのセクションが続きます。iOS では証明書ストアの確認（D7）が `SKIPPED` と表示されます。プラットフォームが証明書ストアの列挙手段を提供していないためで、SDK は推測せずにその旨を報告します。

## 署名

`project.yml` では `DEVELOPMENT_TEAM` を空にしています。**シミュレーター**向けのビルドにはチームも署名用の証明書も不要なので、上記の手順はどの Mac でもそのまま動きます。**実機**で実行するには、`project.yml` の `DEVELOPMENT_TEAM` にお客様の Apple チーム ID を設定し、`xcodegen generate` をもう一度実行してください。Xcode がそのチームの開発用証明書でアプリに署名します。
