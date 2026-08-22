import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import { FONT } from "../theme";
import { WASABI_LABEL, type NetaKind, type WasabiAmount } from "../orders";

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

    const slots = 4;
    const sampleY = height * 0.46;
    const maguroSamples: WasabiAmount[] = ["none", "normal", "extra"];
    maguroSamples.forEach((amount, i) => {
      this.drawSample(width * (i + 0.5) / slots, sampleY, "maguro", amount);
    });
    this.drawSample(width * (3 + 0.5) / slots, sampleY, "tamago", "none");

    const start = this.add.container(width / 2, height - 92);
    const hit = this.add
      .circle(0, 0, 78, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const plate = this.tryAddImage(0, 0, "plate-octagon")?.setDisplaySize(156, 156);
    start.add(hit);
    if (plate) {
      start.add(plate);
    }
    start.add(
      this.add
        .text(0, 4, "スタート", {
          fontFamily: FONT,
          fontSize: "26px",
          color: "#3e2723",
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
  }

  private drawSample(x: number, y: number, neta: NetaKind, wasabi: WasabiAmount): void {
    const root = this.add.container(x, y);
    const plate = this.tryAddImage(0, 10, "plate-empty")?.setDisplaySize(110, 80);
    const netaKey = neta === "tamago" ? "tamago" : "maguro";
    const sushi = this.tryAddImage(0, -6, netaKey)?.setDisplaySize(72, 56);
    if (plate) {
      root.add(plate);
    }
    if (sushi) {
      root.add(sushi);
    }
    if (neta === "maguro" && wasabi !== "none") {
      const size = wasabi === "extra" ? [40, 44] : [22, 24];
      const wasabiImg = this.tryAddImage(18, wasabi === "extra" ? -36 : -24, "wasabi")?.setDisplaySize(
        size[0],
        size[1],
      );
      if (wasabiImg) {
        root.add(wasabiImg);
      }
    }
    const labelText = neta === "tamago" ? "たまご" : WASABI_LABEL[wasabi];
    root.add(
      this.add
        .text(0, 62, labelText, {
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
