const LABEL_COLORS: Record<number, string> = {
  0: '#00a0f2',   // blue
  1: '#00c853',   // green
  2: '#ff6f00',   // orange
  3: '#ff2e74',   // pink
  4: '#7c62e5',   // purple
  5: '#ffd600',   // yellow
  6: '#02b2b8',   // teal
  7: '#ff9a00',   // amber
  8: '#66c060',   // lime
  9: '#fc8383',   // salmon
  10: '#cb7eff',  // lavender
  11: '#5fd0f3',  // sky
  12: '#d4a373',  // tan
  13: '#82b1ff',  // light blue
  14: '#ff8a80',  // coral
  15: '#a5d6a7',  // mint
  16: '#e1bee7',  // light purple
  17: '#bcaaa4',  // brown
  18: '#90a4ae',  // slate
  19: '#b0bec5',  // silver
};

const LABEL_COLOR_FALLBACK = '#6b7280';

export function getLabelColor(colorIndex: number): string {
  return LABEL_COLORS[colorIndex] ?? LABEL_COLOR_FALLBACK;
}
