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
      
      // Upload the banner image
      const response = await fetch(`/api/sellers/upload-banner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sellerToken')}`
        },
        body: JSON.stringify({ bannerImage: base64Image })
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload banner');
      }
      
      const data = await response.json();
      
      // Update the preview and call the callback
      onBannerUploaded(data.data.bannerUrl);
      
      toast({
        title: 'Banner updated',
        description: 'Your store banner has been updated successfully.',
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload banner. Please try again.',
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Store Banner</h3>
          <p className="text-sm text-gray-500">Upload a banner image for your store (recommended size: 1200x300px)</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="relative"
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
            {file ? 'Change' : 'Upload'}
          </Button>
          
          {previewUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveBanner}
              disabled={isUploading}
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
          
          {file && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          )}
        </div>
      </div>
      
      {(previewUrl || currentBannerUrl) && (
        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
          <img
            src={previewUrl || currentBannerUrl}
            alt="Store banner preview"
            className="w-full h-48 object-cover"
          />
        </div>
      )}
    </div>
  );
};

export default BannerUpload;
