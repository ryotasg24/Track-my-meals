/**
 * 写真の縮小（要件定義書 F-AI-04、05、基本設計書 5.12）。
 * canvas に描き直すことで、撮影場所などの付加情報（Exif）が取り除かれる。
 */

/** AIに送る写真：長い辺1024px、JPEG品質0.8 */
export const AI_IMAGE = { maxSide: 1024, quality: 0.8 };
/** 保存する縮小した写真：長い辺320px、JPEG品質0.7 */
export const THUMBNAIL = { maxSide: 320, quality: 0.7 };

type Drawable = ImageBitmap | HTMLImageElement;

async function load(file: Blob): Promise<Drawable> {
  try {
    // 写真の向きの指定（Exif）を反映して読み込む
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // createImageBitmap が使えない・失敗した場合は img 要素で読み込む
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像を読み込めませんでした'));
      };
      img.src = url;
    });
  }
}

async function draw(src: Drawable, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画像を変換できませんでした');
  ctx.drawImage(src, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('JPEGに変換できませんでした');
  return blob;
}

/**
 * 撮った・選んだ写真から、AIに送る写真と縮小した写真を作る。
 * 元の写真は保存しない（F-AI-05）。
 */
export async function preparePhoto(file: Blob): Promise<{ aiImage: Blob; thumbnail: Blob }> {
  const src = await load(file);
  try {
    const aiImage = await draw(src, AI_IMAGE.maxSide, AI_IMAGE.quality);
    const thumbnail = await draw(src, THUMBNAIL.maxSide, THUMBNAIL.quality);
    return { aiImage, thumbnail };
  } finally {
    if ('close' in src) src.close();
  }
}
