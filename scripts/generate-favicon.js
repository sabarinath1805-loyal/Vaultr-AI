const sharp = require('sharp');
const fs = require('fs');

const svg = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#ffffff"/>
  <line x1="16" y1="2" x2="16" y2="30" stroke="#1a1916" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="2" y1="16" x2="30" y2="16" stroke="#1a1916" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="5.5" y1="5.5" x2="26.5" y2="26.5" stroke="#1a1916" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="26.5" y1="5.5" x2="5.5" y2="26.5" stroke="#1a1916" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

const svgBuffer = Buffer.from(svg);

async function generate() {
  await sharp(svgBuffer).resize(32, 32).toFile('public/favicon-32.png');
  await sharp(svgBuffer).resize(16, 16).toFile('public/favicon-16.png');
  await sharp(svgBuffer).resize(180, 180).toFile('public/apple-touch-icon.png');
  await sharp(svgBuffer).resize(192, 192).toFile('public/icon-192.png');
  await sharp(svgBuffer).resize(512, 512).toFile('public/icon-512.png');
  console.log('Favicons generated');
}

generate();
