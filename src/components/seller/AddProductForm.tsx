import { useState, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { sellerApi } from '@/api/sellerApi';
import { aestheticCategories } from '../AestheticCategories';
import { ArrowLeft } from 'lucide-react';

interface FormData {
  name: string;
  price: string;
  description: string;
  image: File | null;
  image_url: string; // Store the processed image data URL
  aesthetic: string;
}

export const AddProductForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    price: '',
    description: '',
    image: null,
    image_url: '',
    aesthetic: 'noir'
  });

  // Get the current seller ID from the API
  const getSellerId = async () => {
    try {
      const seller = await sellerApi.getProfile();
      if (!seller?.id) {
        throw new Error('Invalid seller data. Please log in again.');
      }
      return String(seller.id);
    } catch (error) {
      console.error('Error getting seller profile:', error);
      toast({
        title: 'Authentication Error',
        description: 'Please log in to add products.',
        variant: 'destructive',
      });
      navigate('/seller/login');
      throw error; // Re-throw to stop further execution
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const processImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const img = new Image();
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1200;
              const MAX_HEIGHT = 1200;
              const MAX_SIZE_KB = 500; // Max file size in KB
              
              // Calculate new dimensions while maintaining aspect ratio
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height = Math.round((height * MAX_WIDTH) / width);
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width = Math.round((width * MAX_HEIGHT) / height);
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              
              // Draw image on canvas
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                throw new Error('Could not get canvas context');
              }
              
              // Set white background for transparent images
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              
              // Draw the image
              ctx.drawImage(img, 0, 0, width, height);
              
              // Convert to jpeg with quality adjustment to meet size constraints
              let quality = 0.9;
              let imageDataUrl: string;
              
              // Try to keep the image under MAX_SIZE_KB
              do {
                imageDataUrl = canvas.toDataURL('image/jpeg', quality);
                const sizeKB = (imageDataUrl.length * 0.75) / 1024; // Approximate size in KB
                
                if (sizeKB <= MAX_SIZE_KB || quality <= 0.5) {
                  break;
                }
                
                quality -= 0.1;
              } while (quality >= 0.5);

              resolve(imageDataUrl);
            } catch (error) {
              reject(error);
            }
          };
          
          img.onerror = () => {
            reject(new Error('Failed to load image'));
          };
          
          if (event.target?.result) {
            img.src = event.target.result as string;
          } else {
            reject(new Error('Failed to read file'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (JPEG, PNG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Process the image (resize, compress, convert to JPEG)
      const processedImage = await processImage(file);
      
      // Set the preview
      setImagePreview(processedImage);
      
      // Update form data with the processed image
      setFormData(prev => ({
        ...prev,
        image: file,
        image_url: processedImage // Store the processed image data URL
      }));
      
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process image',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get seller ID first
      const sellerId = await getSellerId();
      
      if (!formData.image_url) {
        toast({
          title: 'Image is required',
          description: 'Please upload an image for your product',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.name.trim() || !formData.price || !formData.description.trim()) {
        toast({
          title: 'Missing required fields',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      let imageUrl = formData.image_url;

      // If there's a new image file, process it first
      if (formData.image) {
        try {
          imageUrl = await processImage(formData.image);
        } catch (error) {
          console.error('Error processing image:', error);
          toast({
            title: 'Error',
            description: 'Failed to process image. Please try another image.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      // Prepare the product data
      const productData = {
        name: formData.name,
        price: parseFloat(formData.price),
        description: formData.description,
        image_url: imageUrl,
        aesthetic: formData.aesthetic,
        sellerId: sellerId,
      };

      // Call the API to create the product
      await sellerApi.createProduct(productData);

      toast({
        title: 'Success',
        description: 'Product created successfully!',
      });

      // Reset form with default values
      setFormData({
        name: '',
        price: '',
        description: '',
        image: null,
        image_url: '',
        aesthetic: 'noir',
      });
      setImagePreview('');
      onSuccess();
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/seller/dashboard')}
            className="inline-flex items-center gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-black mb-4">Add New Product</h1>
          <p className="text-gray-600 text-lg font-medium">Create a new product listing for your store</p>
        </div>
        
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-black text-black flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              Product Information
            </CardTitle>
            <CardDescription className="text-gray-600 font-medium">
              Fill in the details below to create your product listing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-bold text-gray-700 uppercase tracking-wide">Product Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter product name"
                required
                      className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
              />
            </div>

                  <div className="space-y-3">
                    <Label htmlFor="price" className="text-sm font-bold text-gray-700 uppercase tracking-wide">Price (KES)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                placeholder="Enter price"
                required
                      className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
              />
            </div>

                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-sm font-bold text-gray-700 uppercase tracking-wide">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter product description"
                rows={4}
                required
                      className="border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
              />
            </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Category</Label>
              <Select
                value={formData.aesthetic}
                onValueChange={(value) => setFormData(prev => ({ ...prev, aesthetic: value }))}
                required
              >
                      <SelectTrigger className="w-full h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl">
                  <SelectValue placeholder="Select an aesthetic" />
                </SelectTrigger>
                <SelectContent>
                  {aestheticCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Product Image</Label>
                    <div className="flex justify-center px-8 pt-8 pb-8 border-2 border-dashed border-gray-300 rounded-2xl hover:border-yellow-400 transition-colors duration-200 bg-gray-50/50">
                      <div className="space-y-4 text-center">
                  {imagePreview ? (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                              className="h-48 w-48 object-cover rounded-2xl shadow-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
                                target.className = 'h-48 w-48 bg-gray-100 p-8 rounded-2xl';
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                              className="absolute -top-2 -right-2 bg-red-500 text-white hover:bg-red-600 rounded-full h-8 w-8"
                        onClick={() => {
                          setImagePreview('');
                          setFormData(prev => ({ ...prev, image: null }));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ) : (
                    <>
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl flex items-center justify-center shadow-lg">
                              <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="space-y-2">
                              <div className="flex text-sm text-gray-600 justify-center">
                        <label
                          htmlFor="image-upload"
                                  className="relative cursor-pointer rounded-xl font-semibold text-yellow-600 hover:text-yellow-700 focus-within:outline-none"
                        >
                          <span>Upload a file</span>
                          <input
                            id="image-upload"
                            name="image-upload"
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                            </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

              <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFormData({
                name: '',
                price: '',
                description: '',
                image: null,
                image_url: '',
                aesthetic: 'noir',
              });
              setImagePreview('');
            }}
            disabled={isLoading}
                  className="h-12 px-8 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 rounded-xl font-semibold"
          >
            Reset
          </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="h-12 px-8 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold"
                >
            {isLoading ? 'Adding...' : 'Add Product'}
          </Button>
        </div>
      </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AddProductForm;
