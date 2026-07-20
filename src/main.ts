import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { SelectScene } from "./game/scenes/SelectScene";
import { GameScene } from "./game/scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 800,
  height: 600,
  backgroundColor: "#6b4226",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, SelectScene, GameScene],
};

new Phaser.Game(config);
