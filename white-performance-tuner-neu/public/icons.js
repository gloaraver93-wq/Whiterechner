const SHOP_ICONS = {
  motoroel: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M29 18L44 13L53 21V61L38 67L29 59V18Z" fill="#9ca3af" stroke="#111215" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M44 13L53 21L41 25L32 17L44 13Z" fill="#d1d5db" stroke="#111215" stroke-width="2" stroke-linejoin="round"/>
    <path d="M33 34L49 29V48L33 53V34Z" fill="#2563eb" stroke="#111215" stroke-width="1.8"/>
    <path d="M36 38L46 35V42L36 45V38Z" fill="#facc15"/>
    <path d="M29 22L21 26V36L25 35V28L29 26V22Z" fill="#6b7280" stroke="#111215" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  ersatzkupplung: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="41" rx="22" ry="15" transform="rotate(-14 40 41)" fill="#dc2626" stroke="#111215" stroke-width="2.5"/>
    <ellipse cx="40" cy="40" rx="14" ry="9" transform="rotate(-14 40 40)" fill="#374151" stroke="#111215" stroke-width="2"/>
    <ellipse cx="40" cy="40" rx="7" ry="4.5" transform="rotate(-14 40 40)" fill="#f59e0b" stroke="#111215" stroke-width="1.8"/>
    <circle cx="29" cy="36" r="2.8" fill="#facc15" stroke="#111215" stroke-width="1.4"/>
    <circle cx="49" cy="32" r="2.8" fill="#facc15" stroke="#111215" stroke-width="1.4"/>
    <circle cx="33" cy="48" r="2.8" fill="#facc15" stroke="#111215" stroke-width="1.4"/>
    <circle cx="51" cy="45" r="2.8" fill="#facc15" stroke="#111215" stroke-width="1.4"/>
  </svg>`,

  ersatzbremsbelaege: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 33C26 24 38 22 46 27L31 44C23 41 18 38 18 33Z" fill="#9ca3af" stroke="#111215" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M21 37L31 44L27 49L17 42L21 37Z" fill="#374151" stroke="#111215" stroke-width="2"/>
    <path d="M35 47C43 38 55 36 63 41L48 58C40 55 35 52 35 47Z" fill="#9ca3af" stroke="#111215" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M38 51L48 58L44 63L34 56L38 51Z" fill="#374151" stroke="#111215" stroke-width="2"/>
  </svg>`,

  ersatzreifen: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="41" rx="14" ry="20" fill="#27272a" stroke="#111215" stroke-width="2.5"/>
    <ellipse cx="34" cy="41" rx="7" ry="11" fill="#52525b" stroke="#111215" stroke-width="2"/>
    <path d="M44 26L58 41L44 56" stroke="#ef4444" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M44 26L58 41L44 56" stroke="#111215" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  fahrwerksteile: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 22L48 46" stroke="#d1d5db" stroke-width="5" stroke-linecap="round"/>
    <path d="M24 22L48 46" stroke="#111215" stroke-width="2" stroke-linecap="round"/>
    <path d="M26 27L35 20L39 25L30 33L42 29L46 35L35 42L47 39L50 45L39 51" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M26 27L35 20L39 25L30 33L42 29L46 35L35 42L47 39L50 45L39 51" stroke="#111215" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M46 44L56 54" stroke="#9ca3af" stroke-width="6" stroke-linecap="round"/>
  </svg>`,

  turbolader: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="42" rx="16" ry="18" transform="rotate(-18 36 42)" fill="#9ca3af" stroke="#111215" stroke-width="2.5"/>
    <ellipse cx="36" cy="42" rx="9" ry="10" transform="rotate(-18 36 42)" fill="#d1d5db" stroke="#111215" stroke-width="2"/>
    <path d="M36 35L38 42L43 39M36 42L31 46M36 42L41 48" stroke="#111215" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M48 27L59 23L62 34L51 39" fill="#6b7280" stroke="#111215" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,

  motorswap: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 31L42 22L58 31V50L38 60L22 50V31Z" fill="#9ca3af" stroke="#111215" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M27 24L35 20L38 25L30 29L27 24Z" fill="#ef4444" stroke="#111215" stroke-width="1.8"/>
    <path d="M38 19L46 15L49 20L41 24L38 19Z" fill="#ef4444" stroke="#111215" stroke-width="1.8"/>
    <path d="M16 36L22 34V45L16 47V36Z" fill="#6b7280" stroke="#111215" stroke-width="2"/>
  </svg>`,

  elektromotor: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="37" cy="42" rx="15" ry="17" fill="#9ca3af" stroke="#111215" stroke-width="2.5"/>
    <ellipse cx="37" cy="42" rx="7" ry="8" fill="#4b5563" stroke="#111215" stroke-width="2"/>
    <path d="M48 31L60 27L60 51L48 55" fill="#d1d5db" stroke="#111215" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M28 24L34 21L34 26L28 29V24Z" fill="#f59e0b" stroke="#111215" stroke-width="1.5"/>
  </svg>`,

  luftfilter: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M26 26L52 38L44 57L18 45L26 26Z" fill="#dc2626" stroke="#111215" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M30 28L22 47M36 31L28 50M42 34L34 53M47 36L39 55" stroke="#7f1d1d" stroke-width="2"/>
    <ellipse cx="48" cy="47.5" rx="5.5" ry="10.5" transform="rotate(23 48 47.5)" fill="#374151" stroke="#111215" stroke-width="2.2"/>
  </svg>`,

  ev_batterie: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 33L46 21L62 34L34 48L18 33Z" fill="#e5e7eb" stroke="#111215" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M25 33L44 25L53 32L34 41L25 33Z" fill="#22c55e" stroke="#111215" stroke-width="1.8"/>
    <path d="M18 33L34 48V56L18 41V33Z" fill="#9ca3af" stroke="#111215" stroke-width="2.2"/>
    <path d="M34 48L62 34V42L34 56V48Z" fill="#6b7280" stroke="#111215" stroke-width="2.2"/>
  </svg>`,

  ev_kuehlmittel: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M28 19L43 14L52 22V61L37 67L28 59V19Z" fill="#3b82f6" stroke="#111215" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M33 33L47 28V48L33 53V33Z" fill="#eff6ff" stroke="#111215" stroke-width="1.6"/>
    <path d="M28 23L21 27V36L25 34V29L28 27V23Z" fill="#2563eb" stroke="#111215" stroke-width="2"/>
  </svg>`,

  zuendkerze: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M48 20L59 31L46 44L35 33L48 20Z" fill="#f3f4f6" stroke="#111215" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M35 33L46 44L38 52L27 41L35 33Z" fill="#9ca3af" stroke="#111215" stroke-width="2.2"/>
    <path d="M27 41L36 50L26 60L19 53L27 41Z" fill="#6b7280" stroke="#111215" stroke-width="2"/>
  </svg>`,

  keramikbremsen: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="38" cy="42" rx="18" ry="20" transform="rotate(-15 38 42)" fill="#6b7280" stroke="#111215" stroke-width="2.5"/>
    <ellipse cx="38" cy="42" rx="9" ry="10" transform="rotate(-15 38 42)" fill="#374151" stroke="#111215" stroke-width="2"/>
    <path d="M44 23L56 28L53 43L41 38L44 23Z" fill="#ef4444" stroke="#111215" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,

  optische_anbauteile: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 44C24 35 45 33 62 39L56 50C42 46 27 47 16 44Z" fill="#ef4444" stroke="#111215" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M28 24L36 22L35 32L27 33L28 24Z" fill="#374151" stroke="#111215" stroke-width="2"/>
    <path d="M42 22L50 20L49 30L41 31L42 22Z" fill="#374151" stroke="#111215" stroke-width="2"/>
  </svg>`,

  lackierset: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 26L46 21L50 32L28 37L24 26Z" fill="#d1d5db" stroke="#111215" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M16 29L24 27L25 34L17 36L16 29Z" fill="#6b7280" stroke="#111215" stroke-width="2"/>
    <path d="M36 35L44 34L41 57L32 56L36 35Z" fill="#374151" stroke="#111215" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M23 38H33V52H23V38Z" fill="#f3f4f6" stroke="#111215" stroke-width="2"/>
  </svg>`,

  fahrzeugraedersatz: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="46" rx="11" ry="15" fill="#27272a" stroke="#111215" stroke-width="2.3"/>
    <ellipse cx="33" cy="46" rx="5" ry="7" fill="#9ca3af" stroke="#111215" stroke-width="1.6"/>
    <ellipse cx="44" cy="36" rx="11" ry="15" fill="#27272a" stroke="#111215" stroke-width="2.3"/>
    <ellipse cx="45" cy="36" rx="5" ry="7" fill="#9ca3af" stroke="#111215" stroke-width="1.6"/>
    <ellipse cx="52" cy="47" rx="11" ry="15" fill="#27272a" stroke="#111215" stroke-width="2.3"/>
    <ellipse cx="53" cy="47" rx="5" ry="7" fill="#9ca3af" stroke="#111215" stroke-width="1.6"/>
  </svg>`,

  reifenrauch_set: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="41" rx="22" ry="14" transform="rotate(-18 40 41)" fill="#b48a5a" stroke="#111215" stroke-width="2.5"/>
    <ellipse cx="40" cy="41" rx="13" ry="8" transform="rotate(-18 40 41)" fill="#3f3f46" stroke="#111215" stroke-width="2"/>
  </svg>`,

  fahrzeugextras_set: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 42L48 28L62 35L32 50L18 42Z" fill="#52525b" stroke="#111215" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M18 42L32 50V56L18 48V42Z" fill="#27272a" stroke="#111215" stroke-width="2.2"/>
    <path d="M32 50L62 35V41L32 56V50Z" fill="#3f3f46" stroke="#111215" stroke-width="2.2"/>
  </svg>`,

  reinigungsset: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M27 28H40V60H27V28Z" fill="#ef4444" stroke="#111215" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M29 21H38L41 25H29V21Z" fill="#374151" stroke="#111215" stroke-width="2"/>
    <path d="M40 44L58 38L62 51L44 58L40 44Z" fill="#3b82f6" stroke="#111215" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,

  reparaturset: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="30" width="40" height="27" rx="4" fill="#dc2626" stroke="#111215" stroke-width="2.5"/>
    <path d="M32 30V23H48V30" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 41H60" stroke="#111215" stroke-width="2.2"/>
    <rect x="36" y="38" width="8" height="7" rx="1" fill="#facc15" stroke="#111215" stroke-width="1.8"/>
  </svg>`,

  gewebeklebeband: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="42" cy="39" rx="16" ry="20" fill="#9ca3af" stroke="#111215" stroke-width="2.5"/>
    <ellipse cx="44" cy="39" rx="7" ry="9" fill="#27272a" stroke="#111215" stroke-width="2"/>
    <path d="M28 45L19 56L28 60L35 51" fill="#d1d5db" stroke="#111215" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,

  leistungsteile: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 34L43 22L59 31V49L36 61L20 52V34Z" fill="#9ca3af" stroke="#111215" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="33" cy="36" rx="4" ry="3" fill="#27272a"/>
    <ellipse cx="42" cy="31" rx="4" ry="3" fill="#27272a"/>
    <ellipse cx="37" cy="43" rx="4" ry="3" fill="#27272a"/>
    <path d="M34 52L54 42L57 47L37 57L34 52Z" fill="#ef4444" stroke="#111215" stroke-width="1.8"/>
  </svg>`
};

// Icons aus dem Spiel (PNG in public/icons/). Fehlt ein PNG, wird das SVG als Fallback genutzt.
const SHOP_ICON_PNG = new Set([
  "fahrwerksteile", "motoroel", "motorswap", "ersatzreifen", "luftfilter", "elektromotor",
  "ersatzkupplung", "ev_batterie", "zuendkerze", "ersatzbremsbelaege", "ev_kuehlmittel",
  "keramikbremsen", "optische_anbauteile", "lackierset", "fahrzeugraedersatz", "reifenrauch_set",
  "fahrzeugextras_set", "reinigungsset", "reparaturset", "gewebeklebeband", "leistungsteile"
]);

function getItemIconHtml(item) {
  if (item.customImage) {
    return `<img src="${item.customImage}" alt="${item.name}" class="w-16 h-16 object-contain rounded" />`;
  }
  const key = SHOP_ICONS[item.iconKey] ? item.iconKey : "leistungsteile";
  if (SHOP_ICON_PNG.has(key)) {
    return `<img src="/icons/${key}.png" alt="${item.name}" class="shop-icon" loading="lazy" />`;
  }
  return SHOP_ICONS[key];
}
