import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './mobileApp';

/**
 * Bridge to the custom native `SocialShare` Capacitor plugin (see
 * android/.../SocialSharePlugin.java). Two paths, because the two networks allow
 * very different things:
 *   - Instagram exposes an ADD_TO_STORY intent that drops our image straight into
 *     the Story composer (requires the Facebook App ID). True one-tap.
 *   - WhatsApp has NO API to post to Status, so the best possible is the system
 *     share sheet pre-loaded with the card — the user taps WhatsApp then "My status".
 */
export interface SocialSharePlugin {
  shareToInstagramStory(options: { pngBase64: string }): Promise<{ shared: boolean }>;
  shareImage(options: { pngBase64: string; caption?: string }): Promise<{ shared: boolean }>;
}

const SocialShare = registerPlugin<SocialSharePlugin>('SocialShare');

// exportCardAsPng() returns a "data:image/png;base64,XXXX" URL; native wants the
// raw base64 payload only.
const stripDataUrl = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
};

const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const [meta, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/png';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
};

// Web fallback: use the Web Share API with the file if available, otherwise
// trigger a plain download so the user can post it manually.
const webShareOrDownload = async (dataUrl: string, caption: string): Promise<'shared' | 'downloaded'> => {
  const file = dataUrlToFile(dataUrl, 'byblos-card.png');
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: caption });
      return 'shared';
    } catch {
      /* user cancelled — fall through to download */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'byblos-card.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
};

const WHATSAPP_CAPTION = 'I shop protected on Byblos 🛡️ byblos.space';

/** Open the card directly in the Instagram Stories composer (native), else share/download. */
export const shareCardToInstagram = async (dataUrl: string): Promise<void> => {
  if (isNativeApp()) {
    try {
      await SocialShare.shareToInstagramStory({ pngBase64: stripDataUrl(dataUrl) });
      return;
    } catch {
      // Instagram not installed / intent unavailable — fall back to the chooser.
      await SocialShare.shareImage({ pngBase64: stripDataUrl(dataUrl), caption: WHATSAPP_CAPTION });
      return;
    }
  }
  await webShareOrDownload(dataUrl, WHATSAPP_CAPTION);
};

/** Share the card to WhatsApp (native share sheet → user picks "My status"), else share/download. */
export const shareCardToWhatsApp = async (dataUrl: string): Promise<void> => {
  if (isNativeApp()) {
    await SocialShare.shareImage({ pngBase64: stripDataUrl(dataUrl), caption: WHATSAPP_CAPTION });
    return;
  }
  await webShareOrDownload(dataUrl, WHATSAPP_CAPTION);
};
