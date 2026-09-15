const paths: Record<string, string> = {
  axe: '<path d="m5 20 11-14M12 4l4-2 6 6-3 4-7-8Z"/>',
  tree: '<path d="m12 2-7 9h4l-6 7h18l-6-7h4L12 2ZM12 18v4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-5a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9m3-10v12"/>',
  wood: '<path d="M5 8 16 3l5 11-11 5Z"/><ellipse cx="7" cy="14" rx="4" ry="6" transform="rotate(-25 7 14)"/><path d="m12 7 5 10M6 12l2 4"/>',
  meat: '<path d="M9 15c-7-5 0-15 7-11s5 12-3 13l-3 4-3-3 2-3Z"/>',
  heart:
    '<path d="M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-5 5 3 11 8 15 5-4 13-10 8-15Z"/>',
  shield:
    '<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  gloves:
    '<path d="M7 21 4 12c-1-3 2-4 4-1V5c0-3 3-3 3 0V3c0-2 3-2 3 0v3c0-3 3-3 3 0v2c0-2 3-2 3 0v6l-3 7H7Z"/>',
  boots: '<path d="M6 3h9v10l5 3v5H3v-5l3-3V3ZM6 8h9"/>',
  camp: '<path d="m12 3 10 17H2L12 3Zm0 7v10m0-10 5 10"/>',
  people:
    '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4c0-6 12-6 12 0v4m1-17c5 0 5 6 0 6m3 4c3 1 3 4 3 7"/>',
  tower:
    '<path d="M7 21V10h10v11M4 10h16V3h-4v3h-2V3h-4v3H8V3H4v7Zm6 11v-5h4v5"/>',
  flag: '<path d="M5 22V3m0 0c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  cart: '<path d="M2 4h3l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  map: '<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17"/>',
  book: '<path d="M12 5C9 2 5 2 2 3v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-3-1-7-1-10 2Zm0 0v16"/>',
  trophy:
    '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3c0 4 4 4 4 4m10-7h4v3c0 4-4 4-4 4m-5 3v6m-5 0h10"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sound:
    '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  home: '<path d="m2 11 10-9 10 9M5 9v12h14V9m-10 12v-8h6v8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
};
export function icon(name: string): string {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.spark}</svg>`;
}
export function mountIcons(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-icon]").forEach((element) => {
    element.innerHTML = icon(element.dataset.icon!);
  });
}
