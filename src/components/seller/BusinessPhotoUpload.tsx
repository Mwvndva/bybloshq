import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { useUploadBusinessPhotoMutation } from '@/hooks/seller/useSellerProfile';
import { getImageUrl } from '@/lib/utils';

interface BusinessPhotoUploadProps {
  currentPhotoUrl?: string;
  fallbackInitials: string;
  onPhotoUploaded: (photoUrl: string) => void;
}

const getPreviewSrc = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  return getImageUrl(url);
};

export const BusinessPhotoUpload = ({ currentPhotoUrl, fallbackInitials, onPhotoUploaded }: BusinessPhotoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [file, setFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    setPreviewUrl(currentPhotoUrl || null);
  }, [currentPhotoUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setPhotoError('Business photo exceeds 5MB limit');
      toast({
        title: 'File too large',
        description: 'Maximum business photo size is 5MB.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setPhotoError('');
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }, []);

  const fileToBase64 = (selectedFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const uploadBusinessPhotoMutation = useUploadBusinessPhotoMutation();

  const handleUpload = useCallback(async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      const base64Image = await fileToBase64(file);
      const { businessPhotoUrl } = await uploadBusinessPhotoMutation.mutateAsync(base64Image);

      setFile(null);
      setPreviewUrl(businessPhotoUrl);
      onPhotoUploaded(businessPhotoUrl);

      toast({
        title: 'Business photo updated',
        description: 'Your business photo has been uploaded successfully.',
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error('Error uploading business photo:', error);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to upload business photo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [file, onPhotoUploaded, uploadBusinessPhotoMutation]);

  const handleRemove = useCallback(async () => {
    try {
      setIsUploading(true);
      await uploadBusinessPhotoMutation.mutateAsync('');

      setFile(null);
      setPreviewUrl(null);
      onPhotoUploaded('');

      toast({
        title: 'Business photo removed',
        description: 'Your business photo has been removed.',
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error('Error removing business photo:', error);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to remove business photo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onPhotoUploaded, uploadBusinessPhotoMutation]);

  const imageSrc = getPreviewSrc(previewUrl || currentPhotoUrl);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-yellow-200 to-yellow-400 border border-slate-200 overflow-hidden flex items-center justify-center text-xl font-black text-black shrink-0 shadow-sm">
          {imageSrc ? (
            <img src={imageSrc} alt="Business photo preview" className="h-full w-full object-cover" />
          ) : (
            <span>{fallbackInitials}</span>
          )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-yellow-200 bg-yellow-100 p-2">
                <ImageIcon className="h-4 w-4 text-yellow-700" />
              </div>
              <h4 className="text-sm font-bold text-slate-950">Business Photo</h4>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">
              Square images work best. This appears on your public shop page.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="default"
              className={`relative w-full border bg-white text-slate-700 hover:bg-slate-50 ${photoError ? 'border-red-500' : 'border-slate-200 hover:border-yellow-400'}`}
              disabled={isUploading}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                disabled={isUploading}
              />
              <UploadCloud className="h-4 w-4 mr-2" />
              <span className="text-sm font-semibold">{file ? 'Change Photo' : 'Upload Photo'}</span>
            </Button>

            {(previewUrl || currentPhotoUrl) && !file && (
              <Button
                variant="outline"
                size="default"
                onClick={handleRemove}
                disabled={isUploading}
                className="w-full border border-red-200 bg-white text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                <span className="text-sm font-semibold">Remove</span>
              </Button>
            )}

            {file && (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full bg-yellow-400 text-black hover:bg-yellow-300"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span className="font-semibold">Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    <span className="font-semibold">Save Photo</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {photoError && <p className="text-[10px] font-bold text-red-600">{photoError}</p>}
        </div>
      </div>
    </div>
  );
};

export default BusinessPhotoUpload;


