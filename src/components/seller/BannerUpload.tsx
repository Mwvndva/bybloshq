import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, X } from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';

interface BannerUploadProps {
  currentBannerUrl?: string;
  onBannerUploaded: (bannerUrl: string) => void;
}

export const BannerUpload = ({ currentBannerUrl, onBannerUploaded }: BannerUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentBannerUrl || null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (JPEG, PNG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = useCallback(async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      
      // Convert file to base64
      const base64Image = await fileToBase64(file);
      
      // Upload the banner image using the sellerApi
      const { bannerUrl } = await sellerApi.uploadBanner(base64Image);
      
      // Update the preview and call the callback
      onBannerUploaded(bannerUrl);
      setPreviewUrl(bannerUrl);
      setFile(null);
      
      toast({
        title: 'Banner updated',
        description: 'Your store banner has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error uploading banner:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to upload banner. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [file, onBannerUploaded]);

  const handleRemoveBanner = useCallback(async () => {
    try {
      setIsUploading(true);
      
      // Update the seller's banner to empty
      const response = await fetch(`/api/sellers/upload-banner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sellerToken')}`
        },
        body: JSON.stringify({ bannerImage: '' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove banner');
      }
      
      setFile(null);
      setPreviewUrl(null);
      onBannerUploaded('');
      
      toast({
        title: 'Banner removed',
        description: 'Your store banner has been removed.',
      });
    } catch (error) {
      console.error('Error removing banner:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove banner. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onBannerUploaded]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-black truncate">Store Banner</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Upload a banner image for your store (recommended size: 1200x300px)</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="relative flex-1 sm:flex-none"
            disabled={isUploading}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <UploadCloud className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            <span className="text-xs sm:text-sm">{file ? 'Change' : 'Upload'}</span>
          </Button>

          {previewUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveBanner}
              disabled={isUploading}
              className="flex-1 sm:flex-none"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="text-xs sm:text-sm">Remove</span>
            </Button>
          )}

          {file && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1 sm:flex-none"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                  <span className="text-xs sm:text-sm">Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Save Changes</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {(previewUrl || currentBannerUrl) && (
        <div className="relative rounded-lg sm:rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <img
            src={previewUrl || currentBannerUrl}
            alt="Store banner preview"
            className="w-full h-32 sm:h-40 lg:h-48 object-cover"
          />
        </div>
      )}
    </div>
  );
};

export default BannerUpload;
