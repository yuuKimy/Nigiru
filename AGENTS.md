# Nigiru

握る体験を軸にした Phaser 3 ゲーム（わさびパニック）。

## 技術スタック

- TypeScript / Vite / Phaser 3
- 画面 800×600、`scale.mode: FIT`
- 画像は Gemini 生成のスプライト（マゼンタキーで透過）
- 効果音は当面 `src/game/audio/SoundFx.ts` の Web Audio 合成

## 仕様の正

- **現行プレイ**は職人が注文どおりに握ってレーンへ流すモード（[`docs/wasabi-panic-chef-plan.md`](docs/wasabi-panic-chef-plan.md)）
- ネタ追加（たまご等）の設計正は [`docs/wasabi-panic-neta-plan.md`](docs/wasabi-panic-neta-plan.md)
- 旧い「取る」仕様の記録は [`docs/wasabi-panic-plan.md`](docs/wasabi-panic-plan.md)
- 依頼されていないプレイ数値・ルールは変えない

## ドキュメント一覧

| ファイル | 用途 |
| --- | --- |
| `wasabi-panic-chef-plan.md` | 職人プレイ仕様 |
| `wasabi-panic-neta-plan.md` | 第2ネタ（たまご）方針 |
| `wasabi-panic-test-plan.md` | 機能・回帰テスト |
| `wasabi-panic-fun-test-plan.md` | ゲーム性（T/P/D/V）検証 |
| `wasabi-panic-ui-qa-plan.md` | 見た目 QA（preview 推奨） |
| `fun-test-log/` | 開発者向け fun-test 記録 |

## エージェント向け skill

| skill | 場所 | 用途 |
| --- | --- | --- |
| **nigiru-dev** | [`.cursor/skills/nigiru-dev/SKILL.md`](.cursor/skills/nigiru-dev/SKILL.md) | Nigiru 固有の仕様・ファイル・定数 |
| **game-dev-verification** | `~/.cursor/skills/game-dev-verification/SKILL.md` | 素材・検証の汎用手順（全ゲーム共通） |

汎用の素材パイプライン・4層検証・Phaser 表示サイズの落とし穴は **game-dev-verification** を正とする。

## ディレクトリ

- `src/main.ts` — Game 起動。既存 Game を destroy してから new する
- `src/game/scenes/` — 1 ファイル 1 Scene（Boot / Select / Game）
- `src/game/orders.ts` / `rules.ts` — 注文抽選・判定・得点（Vitest あり）
- `src/game/theme.ts` — フォント、`formatScore()`
- `public/assets/sushi/` `public/assets/ui/` — 画像。Boot で preload
- `docs/images/` — README 用スクショ（`select.png` / `play.png`）
- `scripts/capture-screenshots.mjs` — スクショ撮影
- `scripts/simulate-fun-metrics.mjs` — 難度メトリクス試算
- `.tmp_refs/` — 生成用の作業画像（コミットしない）

## 開発コマンド

- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` — Vitest（`orders.test.ts`, `rules.test.ts`）
- スクショ: dev サーバ起動中に `node scripts/capture-screenshots.mjs`（Chrome 実ウィンドウ。`headless: "new"` は使わない）
- `vite.config.ts` 変更後は dev サーバを入れ直す

## コーディング方針

- ゲーム変更は `src/game/`、起動設定は `src/main.ts`。`index.html` は最小
- ロジックは Scene に詰め込みすぎず、必要なら `src/game/` に小さなモジュールへ分ける
- アセットパスは相対（`base: "./"`）
- 変更は依頼範囲に限定する

## Phaser + Vite（必須）

HMR では Game が残る。画像キーを消したあと実行中インスタンスが残ると、緑の `__MISSING` テクスチャが出る。

- `src/main.ts` の destroy ＋フルリロードを外さない
- 無いキーでは `add.image` しない。Boot で `loaderror` を拾う
- Scene 遷移は動いている Scene から `this.scene.start` する
- **`setDisplaySize` 後に `setScale(1)` を毎フレーム呼ぶと表示サイズが原寸に戻る** — 動的サイズは `setDisplaySize` のみ（skill 参照）

## 画像

- 新規は `#FF00FF` 背景で生成し、透過にしてから `public/assets` へ置く
- レーンは横長の空トラック。楕円カウンターや焼き込み空皿は使わない

## やってはいけないこと

- `.env` や秘密情報をコミットしない
- `.tmp_refs/` `node_modules/` `dist/` をコミットしない
- 破壊的な git 操作を勝手に行わない
- README / 計画書以外のドキュメントを勝手に増やさない
