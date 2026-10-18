import QRCode from "qrcode";

/** Opções padrão: correção de erro "M" (resiste a pequenos danos/sujeira na etiqueta). */
const BASE = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: "#14213dff", light: "#ffffffff" } };

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...BASE, type: "svg" });
}

export async function qrPngDataUrl(text: string, width = 1024): Promise<string> {
  return QRCode.toDataURL(text, { ...BASE, width, type: "image/png" });
}

/** Nome de arquivo seguro para download: "mesa-12-qrcode.png" */
export function qrFileName(label: string, ext: "png" | "svg"): string {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `mesa-${slug || "sem-nome"}-qrcode.${ext}`;
}
