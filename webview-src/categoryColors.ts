export const CATEGORY_COLORS = [
  '#e06c75', // red
  '#e5c07b', // yellow
  '#98c379', // green
  '#56b6c2', // cyan
  '#61afef', // blue
  '#c678dd', // purple
  '#d19a66', // orange
  '#abb2bf', // gray
];

export function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}
