---
name: nigiru-dev
description: >-
  Nigiru（わさびパニック）のゲーム改修・UIアセット・Vitest・ゲーム性検証。
  Phaser 3 / Vite / 職人プレイ（握って流す）向け。
  Use when changing src/game/, adding UI sprites, running npm test,
  fun-test / ui-qa plans, neta or patience UI, or README screenshots.
---

# Nigiru 開発

> 素材作成・4層検証の汎用手順は個人 skill **`game-dev-verification`**（`~/.cursor/skills/game-dev-verification/`）。本書は Nigiru 固有のみ。

## 仕様の優先順位

1. [`docs/wasabi-panic-chef-plan.md`](../../../docs/wasabi-panic-chef-plan.md) — 職人プレイの正
2. 機能別方針書（例: [`docs/wasabi-panic-neta-plan.md`](../../../docs/wasabi-panic-neta-plan.md)）— その機能の設計正
3. [`docs/wasabi-panic-plan.md`](../../../docs/wasabi-panic-plan.md) — 旧「取る」プロトタイプの記録

**依頼されていないプレイ数値・ルールは変えない**（`src/game/rules.ts` の定数など）。

## 現行プレイの要点（2026-08 時点）

| 領域 | 実装 |
| --- | --- |
| 操作 | 下段 **4 等分**ボタン: マグロ×（なし/普通/大盛り）＋ **たまご** |
| PC キー | `1` `2` `3` `4` および `←` `↓` `→`（たまごは `4` のみ） |
| 注文 | `pickCustomerOrder()` — 25% たまご（わさびなし固定）、他はマグロ＋わさび抽選 |
| 判定 | `resolvePlateAtSeats` — **ネタとわさびの両方**一致で正解。不一致は素通り |
| 空席 | テキストではなく `seat-empty` 椅子スプライト |
| 我慢 UI | ゲージ 緑→黄（<55%）→赤（<28%）。黄以降 `anger-mark`（耳付近）。赤は客シェイク |
| スコア表示 | `formatScore()` で千位区切り（`theme.ts`） |

ロジックは `orders.ts` / `rules.ts`、表示は `GameScene.ts` / `SelectScene.ts`。

## 画像アセット追加

1. Gemini 生成。背景 **#FF00FF**、白フチステッカー調は客・皿に合わせる
2. マゼンタ透過（Python 等）→ 四隅アルファ 0 を確認
3. 客系 UI は幅 **~132px** 前後にリサイズ（`customer-adult-a` に合わせる）
4. `public/assets/ui/` または `sushi/` に配置
5. `BootScene.preload` にキー追加
6. Scene では **`textures.exists(key)` が true のときだけ** `add.image`

作業用ソースは `.tmp_refs/`（コミットしない）。マゼンタ透過・四隅チェックの手順は **game-dev-verification** 参照。

## Phaser UI — サイズ変更の落とし穴

**game-dev-verification §3** と同内容。Nigiru では怒りマークで顕在化した。

## 我慢ゲージと怒りマーク

- 閾値: `PATIENCE_ORANGE_RATIO = 0.55`, `PATIENCE_RED_RATIO = 0.28`（`GameScene.ts`）
- 怒りマーク位置: 吹き出し（y≈-86）より **下**の耳付近（大人 x38 y-44 / 子 x34 y-40）
- サイズ: `ANGER_MARK_SIZE` — 子 16px / 大人 20px。赤帯は ×1.1
- 描画順: 吹き出しの後に追加し `bringToTop(angerMark)`（ゲージは最前面）

## ネタ追加の型（たまご先例）

```typescript
type Order = { neta: "maguro" | "tamago"; wasabi: WasabiAmount };
// tamago は wasabi "none" 固定。操作は +1 ボタンのみ（6 択にしない）
```

新ネタは [`docs/wasabi-panic-neta-plan.md`](../../../docs/wasabi-panic-neta-plan.md) を先に更新してから実装。

## テスト

### 単体（必須）

```bash
npm test          # Vitest: orders.test.ts, rules.test.ts
npm run build
```

- 抽選・判定は **決定的 random**（`() => 0.25` 等）で境界値を固定
- ネタ不一致・たまご注文は `rules.test.ts` / `orders.test.ts` に追加

### ゲーム性（任意・計画書ベース）

| 目的 | 参照 | 手段 |
| --- | --- | --- |
| 機能・回帰 | [`docs/wasabi-panic-test-plan.md`](../../../docs/wasabi-panic-test-plan.md) | 手動チェックリスト |
| テンポ・難度 | [`docs/wasabi-panic-fun-test-plan.md`](../../../docs/wasabi-panic-fun-test-plan.md) | `node scripts/simulate-fun-metrics.mjs`、ログは `docs/fun-test-log/` |
| 見た目 | [`docs/wasabi-panic-ui-qa-plan.md`](../../../docs/wasabi-panic-ui-qa-plan.md) | **`npm run preview`** で確認（dev は最終 UI 確認に使わない） |

fun-test の T/P/D 軸で数値変更を検討する場合も、**依頼がなければ定数は触らない**。

### README スクショ

UI を変えたら dev 起動中に:

```bash
node scripts/capture-screenshots.mjs
```

`headless: "new"` は使わない（WebGL が古いフレームのままになる）。

## 変更時のファイル目安

| 変更内容 | 主なファイル |
| --- | --- |
| 注文抽選 | `orders.ts`, `orders.test.ts` |
| 得点・我慢・判定 | `rules.ts`, `rules.test.ts` |
| プレイ UI | `GameScene.ts` |
| タイトル見本 | `SelectScene.ts` |
| 新画像 | `public/assets/`, `BootScene.ts` |
| 表示ユーティリティ | `theme.ts` |

Scene は 1 ファイル 1 Scene。早すぎる抽象化は避ける。
