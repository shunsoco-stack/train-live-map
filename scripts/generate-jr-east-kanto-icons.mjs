import sharp from "sharp";

const source = "public/icons/jr-east-kanto-live-map-source.png";
const titleOverlay = Buffer.from(`
  <svg width="1024" height="1024" viewBox="0 0 1024 1024"
       xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="8"
                      flood-color="#092f22" flood-opacity="0.55"/>
      </filter>
    </defs>
    <rect x="66" y="710" width="892" height="244" rx="82"
          fill="#0b513b" fill-opacity="0.82"
          stroke="#d8ff9c" stroke-opacity="0.72" stroke-width="5"/>
    <g text-anchor="middle"
       font-family="'UD デジタル 教科書体 NP', 'BIZ UDPゴシック', sans-serif"
       font-weight="700"
       fill="#fffaf0"
       stroke="#082e21"
       stroke-linejoin="round"
       paint-order="stroke fill"
       filter="url(#shadow)">
      <text x="512" y="798" font-size="82" stroke-width="13"
            letter-spacing="1">Train Live Map</text>
      <text x="512" y="897" font-size="58" stroke-width="11"
            letter-spacing="1">JR東日本・関東版</text>
    </g>
  </svg>
`);

const icon1024 = "public/icons/train-live-map-jr-east-kanto-1024.png";
await sharp(source)
  .resize(1024, 1024, { fit: "cover" })
  .composite([{ input: titleOverlay }])
  .png({ compressionLevel: 9, quality: 100 })
  .toFile(icon1024);

const outputs = [
  ["public/icons/train-live-map-jr-east-kanto-512.png", 512],
  ["public/icons/train-live-map-jr-east-kanto-192.png", 192],
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 512],
];

for (const [path, size] of outputs) {
  await sharp(icon1024)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path);
}

const ogBackground = Buffer.from(`
  <svg width="1732" height="907" viewBox="0 0 1732 907"
       xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#061812"/>
        <stop offset="0.58" stop-color="#0b3e2d"/>
        <stop offset="1" stop-color="#149154"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.78" cy="0.45" r="0.55">
        <stop offset="0" stop-color="#9dff69" stop-opacity="0.48"/>
        <stop offset="1" stop-color="#9dff69" stop-opacity="0"/>
      </radialGradient>
      <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="9"
                      flood-color="#001c12" flood-opacity="0.7"/>
      </filter>
    </defs>
    <rect width="1732" height="907" fill="url(#bg)"/>
    <rect width="1732" height="907" fill="url(#glow)"/>
    <g fill="none" stroke="#b7ff83" stroke-opacity="0.2">
      <path d="M760 865 C980 650 920 375 1175 230 C1350 130 1535 165 1745 55"
            stroke-width="18" stroke-dasharray="38 18"/>
      <path d="M845 940 C1060 745 1110 535 1395 485 C1530 462 1632 420 1760 325"
            stroke-width="6"/>
    </g>
    <g font-family="'UD デジタル 教科書体 NP', 'BIZ UDPゴシック', sans-serif"
       fill="#fffaf0" filter="url(#text-shadow)">
      <text x="110" y="270" font-size="112" font-weight="700">Train Live Map</text>
      <text x="110" y="405" font-size="68" font-weight="700">JR東日本・関東版</text>
      <text x="112" y="526" font-size="40" font-weight="600"
            fill="#d9ffc0">関東エリアのJR在来線を、見やすく。</text>
    </g>
    <rect x="110" y="610" width="178" height="64" rx="32"
          fill="#d9ffc0"/>
    <text x="199" y="654" text-anchor="middle"
          font-family="'BIZ UDPゴシック', sans-serif"
          font-size="31" font-weight="700" fill="#073323">非公式アプリ</text>
  </svg>
`);

const ogIcon = await sharp(icon1024)
  .resize(590, 590, { fit: "contain" })
  .png()
  .toBuffer();

await sharp(ogBackground)
  .composite([{ input: ogIcon, left: 1070, top: 165 }])
  .png({ compressionLevel: 9, quality: 100 })
  .toFile("public/og-train-live-map-jr-east-kanto.png");
