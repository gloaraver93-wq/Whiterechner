'use strict';
/**
 * Erzeugt die mitgelieferten Standardbilder (SVG) für den Beispielkatalog nach public/img/parts/.
 * Aufruf: npm run images
 * Eigene Fotos lädt man später im Adminbereich pro Teil hoch.
 */
const fs = require('fs');
const path = require('path');
const seed = require('../src/catalog-seed');

const OUT = path.join(__dirname, '..', 'public', 'img', 'parts');
const W = '#eef1f7';

const stroke = (extra = '') => `fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" ${extra}`;

function cog(cx, cy, r, A, fill) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="13" stroke-dasharray="${(2 * Math.PI * r) / 16 - 0.01} ${(2 * Math.PI * r) / 16}" stroke="${W}"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 8}" stroke="${W}"/>
  <circle cx="${cx}" cy="${cy}" r="${Math.max(4, r / 5)}" fill="${fill || A}" stroke="none"/>`;
}

const GLYPHS = {
  engine: (A) => `<g ${stroke()}>
    <rect x="-70" y="-10" width="140" height="62" rx="8"/>
    <rect x="-58" y="-34" width="116" height="24" rx="5" stroke="${A}"/>
    <path d="M-42 -34v-16M-14 -34v-16M14 -34v-16M42 -34v-16"/>
    <path d="M-52 -50h20M-24 -50h20M4 -50h20M32 -50h20" stroke="${A}"/>
    <path d="M-35 -10v62M0 -10v62M35 -10v62" stroke-opacity=".35" stroke-width="3"/>
    <circle cx="-92" cy="24" r="17"/><circle cx="-92" cy="24" r="5" fill="${A}" stroke="none"/>
    <path d="M-92 7H-70M-92 41H-70"/>
    <path d="M70 34h30v-18h20"/></g>`,

  gearbox: (A) => `<g ${stroke()}>${cog(-42, 14, 38, A)}${cog(40, -22, 28, A, A)}${cog(48, 52, 18, A)}</g>`,

  suspension: (A) => `<g ${stroke()}>
    <rect x="-36" y="-76" width="72" height="12" rx="4"/><rect x="-36" y="64" width="72" height="12" rx="4"/>
    <path d="M0 -64v-0" /><path d="M0 -76v-10M0 76v10"/>
    <path d="M-30 -56L30 -44L-30 -32L30 -20L-30 -8L30 4L-30 16L30 28L-30 40L30 52L0 60" stroke="${A}" stroke-width="6"/>
    <path d="M-50 -56v112M50 -56v112" stroke-opacity=".3" stroke-width="3"/></g>`,

  brakes: (A) => {
    let holes = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      holes += `<circle cx="${(Math.cos(a) * 42).toFixed(1)}" cy="${(Math.sin(a) * 42).toFixed(1)}" r="5" stroke-width="3"/>`;
    }
    return `<g ${stroke()}>
      <circle r="68"/><circle r="26"/><circle r="8" fill="${W}" stroke="none"/>${holes}
      <path d="M26 -66 A70 70 0 0 1 68 -22 L46 -12 A48 48 0 0 0 20 -43Z" fill="${A}" stroke="${A}"/></g>`;
  },

  turbo: (A) => {
    let blades = '';
    for (let i = 0; i < 8; i++) blades += `<path d="M0 0Q20 -18 10 -46" transform="rotate(${i * 45})" stroke="${A}" stroke-width="4"/>`;
    return `<g ${stroke()}><circle r="58"/><circle r="12" fill="${A}" stroke="none"/>${blades}
      <path d="M58 -10h38v20H58"/><path d="M-30 -58V-92h60V-58"/></g>`;
  },

  exhaust: (A) => `<g ${stroke()}>
    <path d="M-100 28h46"/><rect x="-54" y="-24" width="84" height="64" rx="22"/>
    <path d="M30 8h36"/><ellipse cx="70" cy="8" rx="11" ry="22" stroke="${A}"/>
    <path d="M96 -6q14 14 0 28M112 -20q22 28 0 56" stroke="${A}" stroke-width="4"/>
    <path d="M-30 -24v64M-8 -24v64" stroke-opacity=".3" stroke-width="3"/></g>`,

  wheel: (A) => {
    let spokes = '';
    for (let i = 0; i < 5; i++) spokes += `<path d="M-9 -14L-15 -52H15L9 -14Z" transform="rotate(${i * 72})" fill="${A}" fill-opacity=".25" stroke="${A}" stroke-width="4"/>`;
    return `<g ${stroke()}><circle r="70" stroke-width="8"/><circle r="56" stroke-opacity=".5" stroke-width="3"/>${spokes}
      <circle r="14" stroke="${A}"/><circle r="4" fill="${W}" stroke="none"/></g>`;
  },

  tire: (A) => `<g ${stroke()}>
    <circle r="68" stroke-width="22" stroke-dasharray="14 8" stroke-opacity=".9"/>
    <circle r="50" stroke-width="3"/><circle r="36" stroke="${A}" stroke-width="5"/><circle r="10" fill="${A}" stroke="none"/>
    <path d="M-36 0h72M0 -36v72" stroke="${A}" stroke-width="3" stroke-opacity=".6"/></g>`,

  shield: (A) => `<g ${stroke()}>
    <path d="M0 -70L58 -46V6Q58 46 0 72Q-58 46 -58 6V-46Z"/>
    <path d="M-24 4l17 17 33-36" stroke="${A}" stroke-width="9"/></g>`,

  spoiler: (A) => `<g ${stroke()}>
    <path d="M-96 -22L72 -40L86 -28L-90 -4Z" fill="${A}" fill-opacity=".25" stroke="${A}"/>
    <path d="M-50 -14V40M42 -26V40"/><path d="M-100 40H100"/><path d="M-100 40Q-100 16 -70 14" stroke-opacity=".4"/></g>`,

  bumper: (A) => `<g ${stroke()}>
    <path d="M-98 26Q-98 -10 -62 -16H62Q98 -10 98 26V44H-98Z"/>
    <rect x="-42" y="-2" width="84" height="26" rx="6"/><path d="M-30 4v14M-14 4v14M2 4v14M18 4v14M34 4v14" stroke-width="3" stroke-opacity=".6"/>
    <circle cx="-72" cy="26" r="9"/><circle cx="72" cy="26" r="9"/>
    <path d="M-104 54H104" stroke="${A}" stroke-width="7"/></g>`,

  skirt: (A) => `<g ${stroke()}>
    <path d="M-102 -2H102L92 30H-92Z"/><path d="M-80 12H80" stroke="${A}" stroke-width="7"/>
    <path d="M-102 -2Q-92 -34 -62 -34Q-34 -34 -28 -2M28 -2Q34 -34 62 -34Q92 -34 102 -2" stroke-opacity=".5"/></g>`,

  hood: (A) => `<g ${stroke()}>
    <path d="M-74 56L-54 -56H54L74 56Z"/>
    <path d="M-22 40L-18 -34M22 40L18 -34" stroke="${A}" stroke-width="7"/>
    <path d="M-40 -8L-36 -40M40 -8L36 -40" stroke-opacity=".4" stroke-width="3"/></g>`,

  paint: (A) => `<g ${stroke()}>
    <rect x="-18" y="-28" width="52" height="92" rx="12"/><rect x="-8" y="-50" width="32" height="22" rx="5"/>
    <path d="M6 -50v-12"/><path d="M-18 4H34" stroke-opacity=".4"/>
    <g fill="${A}" stroke="none"><circle cx="-38" cy="-62" r="5"/><circle cx="-56" cy="-50" r="7"/><circle cx="-42" cy="-40" r="4"/><circle cx="-68" cy="-66" r="4"/><circle cx="-60" cy="-28" r="5"/><circle cx="-80" cy="-44" r="3"/></g></g>`,

  neon: (A) => `<g ${stroke()}>
    <path d="M-96 18Q-92 -8 -52 -14L-26 -40H34L64 -14Q94 -10 98 18Z"/>
    <circle cx="-56" cy="22" r="14"/><circle cx="58" cy="22" r="14"/>
    <path d="M-86 52H90" stroke="${A}" stroke-opacity=".25" stroke-width="22"/><path d="M-86 52H90" stroke="${A}" stroke-width="7"/></g>`,

  xenon: (A) => `<g ${stroke()}>
    <path d="M-92 -34Q10 -60 58 -22Q74 6 52 30Q4 52 -92 30Z"/><circle cx="-8" cy="-2" r="26" stroke="${A}"/><circle cx="-8" cy="-2" r="9" fill="${A}" stroke="none"/>
    <path d="M70 -14L116 -34M74 0H124M70 14L116 34" stroke="${A}" stroke-width="4" stroke-opacity=".8"/></g>`,

  nitro: (A) => `<g ${stroke()}>
    <rect x="-26" y="-40" width="52" height="106" rx="22"/><rect x="-11" y="-62" width="22" height="22" rx="4"/><path d="M0 -62v-12h22"/>
    <path d="M-6 -18L12 2H0L8 36L-14 8H-2Z" fill="${A}" stroke="${A}" stroke-width="3"/></g>`,

  tint: (A) => `<g ${stroke()}>
    <path d="M-80 52L-46 -50H56L88 52Z"/><path d="M-58 52L-24 -50M-26 52L8 -50M6 52L40 -50M38 52L72 -50" stroke="${A}" stroke-width="5" stroke-opacity=".75"/>
    <circle cx="-86" cy="-56" r="12" stroke="${A}"/><path d="M-86 -80v8M-86 -40v8M-110 -56h8M-70 -56h8" stroke="${A}" stroke-width="4"/></g>`,

  steering: (A) => `<g ${stroke()}>
    <circle r="68" stroke-width="12"/><circle r="14" fill="${A}" stroke="none"/>
    <path d="M-14 6L-62 18M14 6L62 18M0 16V64"/><path d="M0 -68v14" stroke="${A}" stroke-width="8"/></g>`,

  placeholder: () => `<g ${stroke()}>
    <path d="M-30 50L28 -8"/><circle cx="40" cy="-20" r="26"/><path d="M52 -42l-12 12 -12 -2 -2 -12 12 -12"/>
    <rect x="-46" y="38" width="32" height="26" rx="6" transform="rotate(-45 -30 51)"/></g>`,
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg({ glyph, accent, tag, level, total }) {
  const g = (GLYPHS[glyph] || GLYPHS.placeholder)(accent);
  let overlay = `<rect x="30" y="30" width="6" height="26" rx="3" fill="${accent}"/>
  <text x="46" y="51" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" letter-spacing="4" fill="#9aa3b5">${esc(String(tag || '').toUpperCase())}</text>`;
  if (level) {
    overlay += `<text x="34" y="372" font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="800" letter-spacing="2" fill="#ffffff">STUFE ${level}</text>`;
    for (let i = 0; i < total; i++) {
      const cx = 610 - (total - 1 - i) * 26;
      overlay += `<circle cx="${cx}" cy="360" r="8" fill="${i < level ? accent : 'none'}" stroke="${accent}" stroke-width="2.5"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c202a"/><stop offset="1" stop-color="#090a0e"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".46" r=".55"><stop offset="0" stop-color="${accent}" stop-opacity=".42"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  <pattern id="st" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="10" height="30" fill="#ffffff" fill-opacity=".035"/></pattern>
</defs>
<rect width="640" height="400" fill="url(#bg)"/>
<rect width="640" height="400" fill="url(#st)"/>
<rect width="640" height="400" fill="url(#glow)"/>
<rect x="0" y="392" width="640" height="8" fill="${accent}"/>
<g transform="translate(320 196) scale(1.18)">${g}</g>
${overlay}
</svg>
`;
}

function collect() {
  const list = [];
  const add = (part, cat) =>
    list.push({
      slug: part.slug,
      glyph: part.glyph || cat.glyph,
      accent: cat.accent,
      tag: cat.tag,
      level: part.level,
      total: part.total,
    });
  for (const top of seed) {
    (top.parts || []).forEach((p) => add(p, top));
    for (const child of top.children || []) child.parts.forEach((p) => add(p, child));
  }
  return list;
}

fs.mkdirSync(OUT, { recursive: true });
const items = collect();
for (const it of items) fs.writeFileSync(path.join(OUT, `${it.slug}.svg`), svg(it));
fs.writeFileSync(path.join(__dirname, '..', 'public', 'img', 'placeholder.svg'), svg({ glyph: 'placeholder', accent: '#6b7385', tag: 'Tuning' }));
fs.writeFileSync(
  path.join(__dirname, '..', 'public', 'img', 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0c10"/><path d="M36 8L16 36h13l-4 20 23-30H34z" fill="#ff4a1c"/></svg>\n`
);
console.log(`${items.length} Bilder + Platzhalter erzeugt in ${OUT}`);
