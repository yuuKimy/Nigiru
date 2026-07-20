import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT_DIR = path.resolve("docs/images");
const GAME_W = 800;
const GAME_H = 600;

async function shotCanvas(page, filePath) {
  const canvas = await page.$("canvas");
  if (!canvas) {
    throw new Error("canvas not found");
  }
  await canvas.screenshot({ path: filePath });
}

async function clickGame(page, gameX, gameY) {
  const canvas = await page.$("canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("canvas box missing");
  }
  const x = box.x + (gameX / GAME_W) * box.width;
  const y = box.y + (gameY / GAME_H) * box.height;
  await page.mouse.click(x, y);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--window-size=1000,800", "--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800 });
    await page.goto("http://localhost:5173/", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await page.waitForSelector("canvas", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    const selectPath = path.join(OUT_DIR, "select.png");
    await shotCanvas(page, selectPath);
    console.log("wrote", selectPath);

    // SelectScene: 子供ボタン (width * 0.3, height / 2 + 20)
    await clickGame(page, GAME_W * 0.3, GAME_H / 2 + 20);
    await new Promise((r) => setTimeout(r, 2200));

    const playPath = path.join(OUT_DIR, "play.png");
    await shotCanvas(page, playPath);
    console.log("wrote", playPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
