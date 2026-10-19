/**
 * Rasmni yuklashdan oldin brauzerning o'zida tayyorlash.
 * Telefon/kamera rasmlari 5–15 MB va 4000 px bo'ladi — saytga 2000 px yetarli,
 * shuning uchun katta rasm kichraytiriladi (WebP, bo'lmasa JPEG). Kichik rasm o'zgarmaydi.
 *
 * Faqat brauzerda ishlaydi (canvas).
 */

export const IMAGE_MAX_SIDE = 2000;
/** Shundan kichik va o'lchami me'yorda bo'lgan rasm o'zgartirilmasdan yuklanadi */
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;
/** Tanlash mumkin bo'lgan eng katta rasm (kichraytirishdan oldin) */
export const IMAGE_MAX_INPUT_BYTES = 25 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function imageExtension(type: string): string {
  return EXT[type] ?? "jpg";
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File): Promise<Blob> {
  // GIF animatsiyasi buzilmasin — o'zgartirilmaydi
  if (file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(width, height));
  if (scale === 1 && file.size <= KEEP_AS_IS_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  // Shaffof PNG (grafik, diagramma) JPEG'da qora fon bo'lib qolmasin
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP'ni qo'llamaydigan brauzer PNG qaytaradi — unda JPEG ga o'tamiz
  const webp = await toBlob(canvas, "image/webp", 0.88);
  if (webp && webp.type === "image/webp") return webp;
  return (await toBlob(canvas, "image/jpeg", 0.88)) ?? file;
}
