import Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";

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

    this.add.rectangle(width / 2, height / 2, width, height, 0x6b4226);

    this.add
      .text(width / 2, 100, "わさびパニック", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "40px",
        color: "#fff8e1",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 160, "あなたはどっち？", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#f5e6d3",
      })
      .setOrigin(0.5);

    this.createRoleButton(width * 0.3, height / 2 + 20, "子供", "わさび抜きを取る", "child");
    this.createRoleButton(width * 0.7, height / 2 + 20, "大人", "わさびありを取る", "adult");

    this.add
      .text(width / 2, height - 48, "ボタンをクリックしてスタート", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#d7ccc8",
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
    const bg = this.add
      .rectangle(x, y, 220, 120, 0x8d6e4c, 1)
      .setStrokeStyle(3, 0xffe082)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y - 18, title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#fff8e1",
      })
      .setOrigin(0.5);

    this.add
      .text(x, y + 22, subtitle, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#efebe9",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0xa1887f));
    bg.on("pointerout", () => bg.setFillStyle(0x8d6e4c));
    bg.on("pointerdown", () => {
      SoundFx.unlock();
      SoundFx.click();
      const data: GameSceneData = { role };
      this.scene.start("Game", data);
    });
  }
}
