// @vitest-environment node
import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { qrFileName, qrPngDataUrl, qrSvg } from "@/lib/qr";

describe("QR Code", () => {
  const url = "https://mesaon.app/m/0123456789abcdef01234567";

  it("PNG gerado decodifica exatamente para o link da mesa", async () => {
    const dataUrl = await qrPngDataUrl(url, 400);
    const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1], "base64"));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(url);
  });

  it("SVG é válido e escalável", async () => {
    const svg = await qrSvg(url);
    expect(svg).toMatch(/^<svg[^>]+viewBox="0 0 \d+ \d+"/);
    expect(svg).not.toContain("<script");
  });

  it("nome de arquivo seguro", () => {
    expect(qrFileName("Varanda 3", "png")).toBe("mesa-varanda-3-qrcode.png");
    expect(qrFileName("Ç/../x", "svg")).toBe("mesa-c-x-qrcode.svg");
  });
});
