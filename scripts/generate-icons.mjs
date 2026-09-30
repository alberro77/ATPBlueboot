// Genera los íconos PNG de la PWA a partir del isotipo BlueBoot.
// Uso: node scripts/generate-icons.mjs   (sharp viene instalado con Next.js)
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const BLUE = "#028BB8";
const BOOT =
  "M21 25 L49.5 22.6 Q50 33 47.5 45 Q49 49.5 53 46 Q58 39.5 64 39.5 Q76.5 39.5 79.5 49 L79.8 75.5 L21.8 75.5 L21.8 56 Q22.5 50.5 24.5 47.5 Q21 40 20.8 32 Z";

/** radius: esquinas redondeadas (0 = cuadrado lleno); scale: tamaño de la bota (maskable necesita margen). */
function svg({ radius, scale }) {
  const offset = (100 - 100 * scale) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${radius}" fill="${BLUE}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${BOOT}" fill="none" stroke="#fff" stroke-width="6.5" stroke-linejoin="round"/>
  </g>
</svg>`);
}

const icons = [
  { file: "icon-192.png", size: 192, radius: 22, scale: 1 },
  { file: "icon-512.png", size: 512, radius: 22, scale: 1 },
  // Android recorta los íconos maskable en círculo/squircle: fondo lleno y bota dentro del 80% central.
  { file: "icon-maskable-512.png", size: 512, radius: 0, scale: 0.75 },
  // iOS aplica sus propias esquinas redondeadas.
  { file: "apple-touch-icon.png", size: 180, radius: 0, scale: 0.85 },
];

await mkdir("public/icons", { recursive: true });
for (const { file, size, radius, scale } of icons) {
  await sharp(svg({ radius, scale }), { density: 600 }).resize(size, size).png().toFile(`public/icons/${file}`);
  console.log(`public/icons/${file}`);
}
