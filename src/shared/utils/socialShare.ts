import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';

/**
 * Bridge to the custom native Android plugin `SocialSharePlugin` (see
 * android/app/src/main/java/co/ke/byblos/app/plugins/SocialSharePlugin.java).
 */
export interface SocialSharePluginInterface {
  shareToInstagramStory(options: { pngBase64?: string; imageBase64?: string }): Promise<void>;
  shareToInstagramStories(options: { pngBase64?: string; imageBase64?: string }): Promise<void>;
  shareImage(options: { pngBase64?: string; imageBase64?: string; caption?: string; text?: string }): Promise<void>;
  shareToWhatsApp(options: { pngBase64?: string; imageBase64?: string; caption?: string; text?: string }): Promise<void>;
}

const SocialShare = registerPlugin<SocialSharePluginInterface>('SocialShare');

export async function shareCardToInstagram(dataUrl: string): Promise<void> {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

  if (isNativeApp()) {
    await SocialShare.shareToInstagramStories({ pngBase64: base64, imageBase64: base64 });
    return;
  }

  // Web fallback: download the PNG so the user can upload to IG manually
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'byblos-founder-card.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function shareCardToWhatsApp(dataUrl: string): Promise<void> {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const shareText = 'I just joined Byblos as a founder member. Every purchase is held safe until it shows up. Check it out at https://byblosafrica.site';

  if (isNativeApp()) {
    await SocialShare.shareToWhatsApp({ pngBase64: base64, imageBase64: base64, caption: shareText, text: shareText });
    return;
  }

  // Web fallback: open WhatsApp Web with pre-filled text
  const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
