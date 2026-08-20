import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import { FONT } from "../theme";
import { WASABI_LABEL, type WasabiAmount } from "../orders";

export class SelectScene extends Phaser.Scene {
  constructor() {
    super("Select");
  }

  create(): void {
    const { width, height } = this.scale;

    this.tryAddImage(0, 0, "wood")?.setOrigin(0).setDisplaySize(width, height);

    this.tryAddImage(width / 2, 78, "title-plaque")?.setDisplaySize(420, 88);
    this.add
      .text(width / 2, 74, "わさびパニック", {
        fontFamily: FONT,
        fontSize: "36px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 132, "注文どおりに握って流せ", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#6d4c2b",
      })
      .setOrigin(0.5);

    const samples: WasabiAmount[] = ["none", "normal", "extra"];
    samples.forEach((amount, i) => {
      const x = width * (0.22 + i * 0.28);
      this.drawSample(x, height * 0.46, amount);
    });

    const start = this.add.container(width / 2, height - 92);
    const hit = this.add
      .circle(0, 0, 78, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const plate = this.tryAddImage(0, 0, "plate-red")?.setDisplaySize(150, 150);
    start.add(hit);
    if (plate) {
      start.add(plate);
    }
    start.add(
      this.add
        .text(0, 4, "スタート", {
          fontFamily: FONT,
          fontSize: "26px",
          color: "#fff8e1",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );

    hit.on("pointerover", () => {
      this.tweens.add({ targets: start, scale: 1.08, duration: 140, ease: "Back.easeOut" });
    });
    hit.on("pointerout", () => {
      this.tweens.add({ targets: start, scale: 1, duration: 140, ease: "Sine.easeOut" });
    });
    hit.on("pointerdown", () => {
      SoundFx.unlock();
      SoundFx.click();
      this.scene.start("Game");
    });

    this.add
      .text(width / 2, height - 28, "下の3ボタンでわさびの量を選んで握る", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#6d4c2b",
      })
      .setOrigin(0.5);
  }

  private drawSample(x: number, y: number, amount: WasabiAmount): void {
    const root = this.add.container(x, y);
    const plate = this.tryAddImage(0, 10, "plate-empty")?.setDisplaySize(110, 80);
    const sushi = this.tryAddImage(0, -6, "maguro")?.setDisplaySize(72, 56);
    if (plate) {
      root.add(plate);
    }
    if (sushi) {
      root.add(sushi);
    }
    if (amount !== "none") {
      const size = amount === "extra" ? [40, 44] : [22, 24];
      const wasabi = this.tryAddImage(18, amount === "extra" ? -36 : -24, "wasabi")?.setDisplaySize(
        size[0],
        size[1],
      );
      if (wasabi) {
        root.add(wasabi);
      }
    }
    root.add(
      this.add
        .text(0, 62, WASABI_LABEL[amount], {
          fontFamily: FONT,
          fontSize: "20px",
          color: "#5d3318",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );
  }

  private tryAddImage(
    x: number,
    y: number,
    key: string,
  ): Phaser.GameObjects.Image | undefined {
    if (!this.textures.exists(key)) {
      console.error(`[Select] missing texture "${key}"`);
      return undefined;
    }
    return this.add.image(x, y, key);
  }
}
