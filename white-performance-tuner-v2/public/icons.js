const FALLBACK_SVG = `<svg viewBox="0 0 80 80" class="w-12 h-12 text-zinc-500" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 34L43 22L59 31V49L36 61L20 52V34Z" fill="#3f3f46" stroke="#18181b" stroke-width="2.5"/>
</svg>`;

function getItemPhotoHtml(item, large = true) {
  const src = item.customImage || item.imageUrl;
  if (src) {
    if (large) {
      return `<img src="${src}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=480&q=80';" />`;
    }
    return `<img src="${src}" alt="${item.name}" class="w-11 h-11 object-cover rounded border border-[#2d3039]" />`;
  }
  return FALLBACK_SVG;
}
