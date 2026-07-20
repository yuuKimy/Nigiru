import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // アセット読み込みはここに追加する
  }

  create(): void {
    this.scene.start("Select");
  }
}
