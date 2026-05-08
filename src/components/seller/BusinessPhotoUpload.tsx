import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';
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

  const handleUpload = useCallback(async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      const base64Image = await fileToBase64(file);
      const { businessPhotoUrl } = await sellerApi.uploadBusinessPhoto(base64Image);

      setFile(null);
      setPreviewUrl(businessPhotoUrl);
      onPhotoUploaded(businessPhotoUrl);

      toast({
        title: 'Business photo updated',
        description: 'Your business photo has been uploaded successfully.',
      });
    } catch (error: any) {
      console.error('Error uploading business photo:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to upload business photo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [file, onPhotoUploaded]);

  const handleRemove = useCallback(async () => {
    try {
      setIsUploading(true);
      await sellerApi.uploadBusinessPhoto('');

      setFile(null);
      setPreviewUrl(null);
      onPhotoUploaded('');

      toast({
        title: 'Business photo removed',
        description: 'Your business photo has been removed.',
      });
    } catch (error: any) {
      console.error('Error removing business photo:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to remove business photo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onPhotoUploaded]);

  const imageSrc = getPreviewSrc(previewUrl || currentPhotoUrl);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-yellow-300 to-yellow-500 border border-white/20 overflow-hidden flex items-center justify-center text-2xl font-black text-black shrink-0 shadow-lg">
          {imageSrc ? (
            <img src={imageSrc} alt="Business photo preview" className="h-full w-full object-cover" />
          ) : (
            <span>{fallbackInitials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl shadow-lg">
              <ImageIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white">Business Photo</h4>
              <p className="text-[10px] sm:text-xs text-gray-400">Square images work best. This appears on your public shop page.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="default"
              className={`relative flex-1 sm:flex-none border-2 bg-transparent text-gray-200 hover:bg-white/5 ${photoError ? 'border-red-500' : 'border-white/15 hover:border-yellow-400'}`}
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
                className="flex-1 sm:flex-none border-2 border-red-400/60 bg-transparent text-red-300 hover:bg-red-500/10"
              >
                <X className="h-4 w-4 mr-2" />
                <span className="text-sm font-semibold">Remove</span>
              </Button>
            )}

            {file && (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700"
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

          {photoError && <p className="text-[10px] font-bold text-red-300">{photoError}</p>}
        </div>
      </div>
    </div>
  );
};

export default BusinessPhotoUpload;
