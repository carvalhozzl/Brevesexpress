/** "12" -> "Mesa 12"; "Varanda 3" -> "Varanda 3" */
export function tableDisplayName(label: string): string {
  const l = label.trim();
  return /^\d+[a-zA-Z]?$/.test(l) ? `Mesa ${l}` : l;
}
