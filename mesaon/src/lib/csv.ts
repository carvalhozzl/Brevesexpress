export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

/**
 * Gera CSV compatível com Excel pt-BR (separador ";", BOM UTF-8) e protegido
 * contra injeção de fórmulas (células iniciadas por = + - @ tab ou CR).
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (raw: string | number | null | undefined): string => {
    if (raw == null) return "";
    let value = String(raw);
    if (typeof raw === "string" && /^[=+\-@\t\r]/.test(value)) value = `'${value}`;
    if (/[";\n\r]/.test(value)) value = `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [columns.map((c) => escape(c.header)).join(";")];
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
