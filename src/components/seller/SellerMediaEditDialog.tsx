import { useState } from 'react';
import { ImageIcon, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { getImageUrl } from '@/lib/utils';
import { useUploadBannerMutation, useUploadBusinessPhotoMutation } from '@/hooks/seller/useSellerProfile';

interface SellerMediaEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarUrl?: string;
  bannerUrl?: string;
  fallbackInitial: string;
}

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
});

const previewSrc = (url?: string | null) => {
  if (!url) return '';
  return url.startsWith('blob:') || url.startsWith('data:') ? url : getImageUrl(url);
};

export function SellerMediaEditDialog({ open, onOpenChange, avatarUrl, bannerUrl, fallbackInitial }: SellerMediaEditDialogProps) {
  const photoMutation = useUploadBusinessPhotoMutation();
  const bannerMutation = useUploadBannerMutation();
  const [busy, setBusy] = useState<null | 'photo' | 'banner'>(null);

  const runUpload = async (
    which: 'photo' | 'banner',
    file: File | null,
    maxMb: number,
    upload: (b64: string) => Promise<unknown>,
    label: string
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please choose an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast({ title: 'File too large', description: `Maximum ${label.toLowerCase()} size is ${maxMb}MB.`, variant: 'destructive' });
      return;
    }
    setBusy(which);
    try {
      const b64 = await fileToBase64(file);
      await upload(b64);
      toast({ title: `${label} updated`, description: `Your ${label.toLowerCase()} has been saved.` });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: err.response?.data?.message || `Failed to update ${label.toLowerCase()}.`, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runRemove = async (
    which: 'photo' | 'banner',
    upload: (b64: string) => Promise<unknown>,
    label: string
  ) => {
    setBusy(which);
    try {
      await upload('');
      toast({ title: `${label} removed` });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: err.response?.data?.message || `Failed to remove ${label.toLowerCase()}.`, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const photoPreview = previewSrc(avatarUrl);
  const bannerPreview = previewSrc(bannerUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-white/10 bg-[#0a0a0a] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Edit photo & banner</DialogTitle>
          <DialogDescription className="text-white/55">Update how your shop looks to buyers.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Business photo */}
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#141414]"
              style={{ border: '3px solid var(--theme-accent, #f5c518)' }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Business photo" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-xl font-black"
                  style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
                >
                  {fallbackInitial}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Business photo</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="relative h-8 font-bold"
                  style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
                  disabled={busy === 'photo'}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    disabled={busy === 'photo'}
                    onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; runUpload('photo', f, 5, (b) => photoMutation.mutateAsync(b), 'Business photo'); }}
                  />
                  {busy === 'photo' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1.5 h-3.5 w-3.5" />}
                  Upload
                </Button>
                {avatarUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
                    disabled={busy === 'photo'}
                    onClick={() => runRemove('photo', (b) => photoMutation.mutateAsync(b), 'Business photo')}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-white/10" />

          {/* Banner */}
          <div>
            <p className="text-sm font-black text-white">Banner</p>
            <div className="mt-2 h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-[#141414]">
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/40">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="relative h-8 font-bold"
                style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
                disabled={busy === 'banner'}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={busy === 'banner'}
                  onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; runUpload('banner', f, 50, (b) => bannerMutation.mutateAsync(b), 'Banner'); }}
                />
                {busy === 'banner' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1.5 h-3.5 w-3.5" />}
                Upload
              </Button>
              {bannerUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
                  disabled={busy === 'banner'}
                  onClick={() => runRemove('banner', (b) => bannerMutation.mutateAsync(b), 'Banner')}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
