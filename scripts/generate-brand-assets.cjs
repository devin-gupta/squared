// Render our vector sources, not an AI-generated/reprocessed bitmap. Sharp is
// installed by Next.js. Committed outputs avoid runtime image/font dependencies.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const root = path.resolve(__dirname, "../public");

async function main() {
  const mark = await fs.readFile(path.join(root, "brand/mark.svg"), "utf8");
  const icon = async (size, square = false) => {
    // A pixel-sized variant keeps the strokes legible in a 16px browser tab.
    const source =
      size === 16
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#223c32"/><rect x="4" y="3.5" width="7" height="7" rx="1.2" fill="none" stroke="#f6f7f3" stroke-width="1.2"/><rect x="7.5" y="7" width="5" height="5" rx="1" fill="#223c32" stroke="#c7d8b5" stroke-width="1.2"/></svg>'
        : square
          ? mark.replace('rx="56"', 'rx="0"')
          : mark;
    return sharp(Buffer.from(source)).resize(size, size).png().toBuffer();
  };
  for (const [size, name] of [
    [16, "favicon-16x16.png"],
    [32, "favicon-32x32.png"],
    [180, "apple-touch-icon.png"],
    [192, "android-chrome-192x192.png"],
    [512, "android-chrome-512x512.png"],
  ]) {
    const output = await icon(size, size >= 180);
    await fs.writeFile(path.join(root, name), output);
    await fs.writeFile(path.join(root, `brand/icon-${size}-v2.png`), output);
  }
  // A multi-resolution ICO for Safari/legacy clients, with crisp small marks.
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map((size) => icon(size)));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16;
    directory[entry] = size;
    directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(images[i].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  await fs.writeFile(
    path.join(root, "favicon.ico"),
    Buffer.concat([directory, ...images]),
  );
  await sharp(path.join(root, "brand/share-card.svg"))
    .png()
    .toFile(path.join(root, "brand/share-card-v2.png"));
  console.log("Rendered Squared icons and 1200×630 share card.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
