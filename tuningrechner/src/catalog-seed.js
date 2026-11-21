'use strict';
/**
 * Beispielkatalog, der beim allerersten Start in die Datenbank geschrieben wird.
 * Alle Preise (in $) sind Beispielwerte und werden im Adminbereich angepasst.
 * Die "img"-Angaben steuern das mitgelieferte Standardbild (scripts/generate-images.js).
 */
function tiers(slug, label, prices, descs) {
  return prices.map((price, i) => ({
    slug: `${slug}-${i + 1}`,
    name: `${label} ${i + 1}`,
    price,
    description: descs[i],
    level: i + 1,
    total: prices.length,
  }));
}

module.exports = [
  {
    name: 'Leistungsteile',
    children: [
      {
        name: 'Motorstufen',
        exclusive: true,
        glyph: 'engine',
        accent: '#ff4a1c',
        tag: 'Motor',
        parts: tiers('motor', 'Motorstufe', [5000, 9000, 15000, 24000], [
          'Optimierte Motorsteuerung und Sportluftfilter für spürbar mehr Leistung.',
          'Überarbeitete Zylinderköpfe und Nockenwelle für kräftigeren Durchzug.',
          'Rennsport-Kolben und Hochleistungs-Einspritzung für maximale Drehfreude.',
          'Vollständig überarbeiteter Rennmotor – die höchste Ausbaustufe.',
        ]),
      },
      {
        name: 'Getriebestufen',
        exclusive: true,
        glyph: 'gearbox',
        accent: '#ffb400',
        tag: 'Getriebe',
        parts: tiers('getriebe', 'Getriebestufe', [3000, 6000, 10000], [
          'Verstärkte Kupplung und kürzere Schaltwege.',
          'Sportgetriebe mit enger gestuften Gängen.',
          'Rennsport-Getriebe mit blitzschnellen Schaltvorgängen.',
        ]),
      },
      {
        name: 'Fahrwerksstufen',
        exclusive: true,
        glyph: 'suspension',
        accent: '#38bdf8',
        tag: 'Fahrwerk',
        parts: tiers('fahrwerk', 'Fahrwerksstufe', [2500, 5000, 8000], [
          'Sportfedern für eine tiefere, stabilere Straßenlage.',
          'Einstellbares Gewindefahrwerk mit strafferer Dämpfung.',
          'Rennfahrwerk für präzises Handling bei hohem Tempo.',
        ]),
      },
      {
        name: 'Bremsenstufen',
        exclusive: true,
        glyph: 'brakes',
        accent: '#ff2e63',
        tag: 'Bremsen',
        parts: tiers('bremsen', 'Bremsenstufe', [2000, 4000, 7000], [
          'Sportbremsbeläge für kürzere Bremswege.',
          'Gelochte Bremsscheiben mit Sportsätteln.',
          'Rennsport-Bremsanlage mit höchster Standfestigkeit.',
        ]),
      },
    ],
  },
  {
    name: 'Optik & Karosserie',
    glyph: 'spoiler',
    accent: '#a78bfa',
    tag: 'Karosserie',
    parts: [
      { slug: 'heckspoiler', glyph: 'spoiler', name: 'Heckspoiler Sport', price: 2500, description: 'Dezenter Sportspoiler für mehr Abtrieb und einen sportlichen Look.' },
      { slug: 'gt-fluegel', glyph: 'spoiler', name: 'GT-Heckflügel', price: 4500, description: 'Großer Heckflügel im Rennsport-Stil.' },
      { slug: 'frontstossstange', glyph: 'bumper', name: 'Frontstoßstange Sport', price: 3200, description: 'Aggressive Frontschürze mit Splitter und großen Lufteinlässen.' },
      { slug: 'heckstossstange', glyph: 'bumper', name: 'Heckstoßstange Sport', price: 3000, description: 'Sportliche Heckschürze mit integriertem Diffusor.' },
      { slug: 'seitenschweller', glyph: 'skirt', name: 'Seitenschweller', price: 2200, description: 'Tiefgezogene Seitenschweller für eine geschlossene Seitenlinie.' },
      { slug: 'carbonhaube', glyph: 'hood', name: 'Carbon-Motorhaube', price: 5500, description: 'Leichte Carbonhaube mit Lufthutze.' },
      { slug: 'sportauspuff', glyph: 'exhaust', name: 'Sport-Auspuff', price: 2800, description: 'Sportauspuffanlage mit kernigem Sound.' },
      { slug: 'racingauspuff', glyph: 'exhaust', name: 'Racing-Auspuff', price: 4200, description: 'Offene Rennsportanlage mit maximaler Klangfülle.' },
    ],
  },
  {
    name: 'Felgen & Reifen',
    glyph: 'wheel',
    accent: '#94a3b8',
    tag: 'Felgen & Reifen',
    parts: [
      { slug: 'sportfelgen', glyph: 'wheel', name: 'Sportfelgen', price: 3500, description: 'Leichte Mehrspeichen-Felgen im Sportdesign.' },
      { slug: 'musclefelgen', glyph: 'wheel', name: 'Muscle-Felgen', price: 3800, description: 'Kräftige Felgen im klassischen Muscle-Car-Stil.' },
      { slug: 'offroadfelgen', glyph: 'wheel', name: 'Offroad-Felgen', price: 3600, description: 'Robuste Felgen für Gelände und Schotter.' },
      { slug: 'performancereifen', glyph: 'tire', name: 'Performance-Reifen', price: 1800, description: 'Hochleistungsreifen mit maximalem Grip.' },
      { slug: 'kugelsichere-reifen', glyph: 'shield', name: 'Kugelsichere Reifen', price: 4000, description: 'Pannensichere Spezialreifen mit Schutzeinlage.' },
    ],
  },
  {
    name: 'Lackierung',
    glyph: 'paint',
    accent: '#f472b6',
    tag: 'Lackierung',
    parts: [
      { slug: 'metallic', glyph: 'paint', name: 'Metallic-Lackierung', price: 1500, description: 'Brillanter Metallic-Lack mit Tiefenglanz.' },
      { slug: 'matt', glyph: 'paint', name: 'Matt-Lackierung', price: 2000, description: 'Edle, matte Oberfläche für einen markanten Auftritt.' },
      { slug: 'chrom', glyph: 'paint', name: 'Chrom-Lackierung', price: 6000, description: 'Spiegelnde Chrom-Optik – ein echter Hingucker.' },
      { slug: 'streifen', glyph: 'paint', name: 'Zweitfarbe & Streifen', price: 1200, description: 'Rennstreifen und Akzente in einer zweiten Farbe.' },
    ],
  },
  {
    name: 'Beleuchtung',
    glyph: 'xenon',
    accent: '#facc15',
    tag: 'Beleuchtung',
    parts: [
      { slug: 'xenon', glyph: 'xenon', name: 'Xenon-Scheinwerfer', price: 1200, description: 'Helles, kühles Xenonlicht für klare Sicht.' },
      { slug: 'neon', glyph: 'neon', name: 'Neon-Unterbodenbeleuchtung', price: 2400, description: 'Farbige Neon-Beleuchtung unter dem Fahrzeug.' },
    ],
  },
  {
    name: 'Extras',
    glyph: 'turbo',
    accent: '#34d399',
    tag: 'Extras',
    parts: [
      { slug: 'turbo', glyph: 'turbo', name: 'Turbo', price: 12000, description: 'Turbolader für zusätzlichen Schub im gesamten Drehzahlbereich.' },
      { slug: 'nitro', glyph: 'nitro', name: 'Nitro-Einspritzung', price: 9000, description: 'Distickstoffoxid-Einspritzung für kurze Leistungsspitzen.' },
      { slug: 'tint', glyph: 'tint', name: 'Fenstertönung', price: 900, description: 'Getönte Scheiben für Privatsphäre und Stil.' },
      { slug: 'sportlenkrad', glyph: 'steering', name: 'Sportlenkrad', price: 1600, description: 'Griffiges Sportlenkrad mit abgeflachtem Kranz.' },
    ],
  },
];
