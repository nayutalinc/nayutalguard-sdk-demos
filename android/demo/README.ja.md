<!-- en-source: android/demo/README.md sha256:b8480e0b9a5e52896f1b05cd6e812190d1635c6a1891d0c1f17c516eec3167f5 -->
# NayutalGuard SDK — Android デモ

English: [README.md](README.md)

> この日本語版は英語版（README.md）から翻訳したものです。英語版が正本です。コード、パス、バージョン、ハッシュ値、リンク先が英語版と同一であることを CI が検証しています。

SDK を組み込む一連の流れを示す最小限のホストアプリです。端末の情報を集め、SDK に渡し、検出結果を表示します。標準ウィジェットのみ、アクティビティは 1 つ、UI フレームワークは使いません。主役は組み込みであってアプリではありません。

このプロジェクトは**単独で**ビルドできます。お客様と同じ方法で、出荷済みの SDK 成果物を組み込んでいます。ここでビルドできるものは、お客様の環境でもビルドできます。

## 前提条件

- JDK 17
- API 35 を含む Android SDK（`compileSdk = 35`、`minSdk = 26`）
- `ANDROID_HOME` に SDK の場所を設定するか、このフォルダーを Android Studio で開いてください（自動で設定されます）

Gradle 本体は同梱しています。付属の `./gradlew` を使ってください。別途インストールは不要です。

## 1. SDK の成果物を入手する

`nayutal-sdk-1.4.2.aar` の入手先は次の 2 つのいずれかで、内容は同じバイト列です。

- 組み込みの際に Nayutal からお渡しした SDK パッケージ（通常はこちらです）
- **sdk-v1.4.2** の GitHub リリースのアセット。お客様の組み込みに `nayutalguard` リポジトリへのアクセスが含まれている場合に利用できます（このページは公開されていません）。

```text
https://github.com/nayutalinc/nayutalguard/releases/tag/sdk-v1.4.2
```

いずれの場合も、組み込む前に手順 2 で公開されているハッシュ値の一覧表と照合してください。

## 2. 使う前に検証する

リリースノートには成果物ごとに SHA-256 を掲載しています。ダウンロードしたファイルをそのページの値と照合してください。

```bash
shasum -a 256 nayutal-sdk-1.4.2.aar
```

`nayutal-sdk-1.4.2.aar` の期待値:

```text
e4e9c04972ff7d5dec71d84530ca318e6f7198899972fabce51c37fd9545a232
```

一致しない場合は作業を止めて、私たちにご連絡ください。その成果物に対してビルドしないでください。

## 3. 配置する

```bash
mkdir -p libs
cp /path/to/nayutal-sdk-1.4.2.aar libs/
```

`libs/*.aar` は意図的に gitignore しています。成果物はダウンロードして検証するものであり、コミットするものではありません。

## 4. API キーを渡す

キーはビルド時に注入し、ソースコードには決して書きません。

```bash
./gradlew assembleDebug -PNAYUTAL_API_KEY=your-key-here
```

繰り返しビルドする場合は、`~/.gradle/gradle.properties` に書いてください（このプロジェクトの外にあるため、誤ってコミットすることがありません）。

```properties
NAYUTAL_API_KEY=your-key-here
```

接続先は既定で本番環境です。同じ方法で上書きできます。

```bash
-PNAYUTAL_BASE_URL=https://<base-url-you-received>/
```

## 5. ビルドして実行する

```bash
./gradlew assembleDebug -PNAYUTAL_API_KEY=your-key-here
./gradlew installDebug  -PNAYUTAL_API_KEY=your-key-here   # device/emulator attached
```

その後、ランチャーから **Nayutal SDK Demo** を起動するか、次を実行してください。

```bash
adb shell am start -n com.nayutal.sdkdemo/.MainActivity
```

**Run Scan** をタップしてください。結果ブロックの先頭には SDK が返したスキーマ（このリリースでは `schema 1.4.0`）が表示され、その後に検出機構ごとのセクションが続きます。

## SDK を更新する

単体の `.aar` には依存関係の情報が含まれないため、このプロジェクトでは SDK の依存関係を自前で宣言しています（`dependencies` ブロックを参照）。新しい成果物に移行する際は、その一覧を SDK のリリースノートと照合し直してください。

依存関係の欠落は一様には現れません。ビルドが通ったことを信頼する前に、次の違いを知っておいてください。

- **実行時**の依存関係（okhttp、coroutines）が危険です。1 つ欠けていてもアプリはきれいにコンパイルされ、最初のスキャンで `NoClassDefFoundError` により落ちます。
- **コンパイル時**の依存関係（`androidx.annotation`）はビルド時にすぐ、目に見える形で失敗します。そのアノテーションは CLASS 保持のため VM が読み込むことはなく、実行時の失敗の原因にはなりません。

つまり、ビルドが成功しても一覧が完全であるとは言えません。SDK を更新したら、必ずアプリを起動してスキャンを実行してください。
