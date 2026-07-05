export function generateNumericString(length: number): string {
  return Array.from({ length: length }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
}
