import { CARD_HEIGHT, CARD_WIDTH } from '../../card/cardFrame';

/**
 * A person's own card picture (shared program E4b): cropped to the card's 1.91:1 around the point they choose, and
 * re-encoded under the product's byte budget (WhatsApp drops a preview picture over about 300 KB).
 */

export const CARD_RATIO = CARD_WIDTH / CARD_HEIGHT;

/** The JPEG qualities tried, best first, until the picture fits the budget. */
export const PICTURE_QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.6] as const;

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Whether the picture is smaller than the card, so the networks will draw it soft. */
export function isSmallerThanCard(width: number, height: number): boolean {
  return width < CARD_WIDTH || height < CARD_HEIGHT;
}

/**
 * The largest 1.91:1 rectangle inside the picture, centred as near the focal point (0..1 on each axis) as the
 * picture's edges allow.
 */
export function cropRect(width: number, height: number, focalX: number, focalY: number): CropRect {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const wide = width / height > CARD_RATIO;
  const sw = wide ? Math.round(height * CARD_RATIO) : width;
  const sh = wide ? height : Math.round(width / CARD_RATIO);

  return {
    sx: Math.round(clamp(focalX * width - sw / 2, 0, width - sw)),
    sy: Math.round(clamp(focalY * height - sh / 2, 0, height - sh)),
    sw,
    sh,
  };
}

/** The size the crop is written at: the card's size, or the crop's own when the picture is smaller. */
export function outputSize(crop: CropRect): { width: number; height: number } {
  if (crop.sw >= CARD_WIDTH) {
    return { width: CARD_WIDTH, height: CARD_HEIGHT };
  }

  return { width: crop.sw, height: Math.round(crop.sw / CARD_RATIO) };
}

export interface LoadedPicture {
  image: HTMLImageElement;
  width: number;
  height: number;
  src: string;
}

/** Reads a chosen file as a picture. The caller revokes `src` (an object URL) when done. */
export function loadPicture(file: File): Promise<LoadedPicture> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight, src });
    image.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error(`"${file.name}" could not be opened as a picture. Use a JPEG, PNG or WebP file.`));
    };
    image.src = src;
  });
}

/**
 * Draws the crop at the card's size and encodes it as JPEG, stepping the quality down until it fits `maxBytes`.
 * Throws with the real sizes when even the lowest quality is too large.
 */
export async function encodeCrop(picture: LoadedPicture, crop: CropRect, maxBytes: number): Promise<{ file: File; width: number; height: number }> {
  const size = outputSize(crop);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('This browser cannot prepare pictures (no canvas). Try another browser.');
  }

  context.drawImage(picture.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size.width, size.height);

  let smallest = Number.POSITIVE_INFINITY;

  for (const quality of PICTURE_QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

    if (!blob) {
      throw new Error('The picture could not be encoded. Try another file.');
    }

    if (blob.size <= maxBytes) {
      return { file: new File([blob], 'social-card.jpg', { type: 'image/jpeg' }), ...size };
    }

    smallest = Math.min(smallest, blob.size);
  }

  throw new Error(
    `The picture is still ${Math.round(smallest / 1000)} KB at the lowest quality, over the ${Math.round(maxBytes / 1000)} KB a shared link allows. Try a simpler picture.`,
  );
}
