import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';

interface BannerUploadProps {
  currentBannerUrl?: string;
  onBannerUploaded: (bannerUrl: string) => void;
}

export const BannerUpload = ({ currentBannerUrl, onBannerUploaded }: BannerUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentBannerUrl || null);
  const [file, setFile] = useState<File | null>(null);

  // Update preview URL when currentBannerUrl changes (e.g., after refresh)
  useEffect(() => {
    console.log('BannerUpload: currentBannerUrl changed:', currentBannerUrl);
    console.log('BannerUpload: previewUrl before update:', previewUrl);
    if (currentBannerUrl) {
      setPreviewUrl(currentBannerUrl);
      console.log('BannerUpload: updated previewUrl to:', currentBannerUrl);
    }
  }, [currentBannerUrl]);

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
      
      // Update the seller's banner to empty using sellerApi
      await sellerApi.uploadBanner('');
      
      setFile(null);
      setPreviewUrl(null);
      onBannerUploaded('');
      
      toast({
        title: 'Banner removed',
        description: 'Your store banner has been removed.',
      });
    } catch (error: any) {
      console.error('Error removing banner:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to remove banner. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onBannerUploaded]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl shadow-lg">
          <ImageIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Store Banner</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Upload a banner image for your store (recommended: 1200x300px)</p>
        </div>
      </div>

      {/* Preview Section */}
      {(previewUrl || currentBannerUrl) ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 shadow-md group">
          <img
            src={previewUrl || currentBannerUrl}
            alt="Store banner preview"
            className="w-full h-40 sm:h-48 lg:h-56 object-cover"
          />
          {previewUrl && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">Preview</span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-white rounded-full shadow-md mb-4">
              <UploadCloud className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No banner uploaded</p>
            <p className="text-xs text-gray-500">Upload a banner to make your store stand out</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          size="default"
          className="relative flex-1 sm:flex-none border-2 border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 transition-all"
          disabled={isUploading}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <UploadCloud className="h-4 w-4 mr-2" />
          <span className="text-sm font-semibold">{file ? 'Change Image' : 'Upload Banner'}</span>
        </Button>

        {(previewUrl || currentBannerUrl) && !file && (
          <Button
            variant="outline"
            size="default"
            onClick={handleRemoveBanner}
            disabled={isUploading}
            className="flex-1 sm:flex-none border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500"
          >
            <X className="h-4 w-4 mr-2" />
            <span className="text-sm font-semibold">Remove</span>
          </Button>
        )}

        {file && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex-1 sm:flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-lg hover:shadow-xl transition-all"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="font-semibold">Uploading...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4 mr-2" />
                <span className="font-semibold">Save Changes</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default BannerUpload;
