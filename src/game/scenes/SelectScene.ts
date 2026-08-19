import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import { FONT } from "../theme";

export type PlayerRole = "child" | "adult";

export type GameSceneData = {
  role: PlayerRole;
};

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
      .text(width / 2, 128, "あなたはどっち？", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#6d4c2b",
      })
      .setOrigin(0.5);

    this.createRoleButton(
      width * 0.28,
      height / 2 + 36,
      "子供",
      "わさび抜きを取る",
      "child",
    );
    this.createRoleButton(
      width * 0.72,
      height / 2 + 36,
      "大人",
      "わさびありを取る",
      "adult",
    );

    this.add
      .text(width / 2, height - 40, "お皿をクリックしてスタート", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#6d4c2b",
      })
      .setOrigin(0.5);
  }

  private createRoleButton(
    x: number,
    y: number,
    title: string,
    subtitle: string,
    role: PlayerRole,
  ): void {
    const isChild = role === "child";
    const plateKey = isChild ? "plate-cat" : "plate-red";
    const sushiKey = isChild ? "tamago" : "maguro";

    const root = this.add.container(x, y);

    const hit = this.add
      .circle(0, 0, 108, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    const plate = this.tryAddImage(0, -8, plateKey)?.setDisplaySize(200, 200);
    const sushi = this.tryAddImage(0, -18, sushiKey)?.setDisplaySize(108, 86);
    root.add(hit);
    if (plate) {
      root.add(plate);
    }
    if (sushi) {
      root.add(sushi);
    }

    const garnish = isChild
      ? this.tryAddImage(36, 18, "ginger")?.setDisplaySize(40, 34)
      : this.tryAddImage(28, -48, "wasabi")?.setDisplaySize(42, 46);
    if (garnish) {
      root.add(garnish);
    }

    const titleText = this.add
      .text(0, 108, title, {
        fontFamily: FONT,
        fontSize: "26px",
        color: "#5d3318",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const subText = this.add
      .text(0, 136, subtitle, {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#7a5634",
      })
      .setOrigin(0.5);
    root.add([titleText, subText]);

    hit.on("pointerover", () => {
      this.tweens.add({
        targets: root,
        scale: 1.08,
        duration: 140,
        ease: "Back.easeOut",
      });
    });
    hit.on("pointerout", () => {
      this.tweens.add({
        targets: root,
        scale: 1,
        duration: 140,
        ease: "Sine.easeOut",
      });
    });
    hit.on("pointerdown", () => {
      SoundFx.unlock();
      SoundFx.click();
      const data: GameSceneData = { role };
      this.scene.start("Game", data);
    });
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
