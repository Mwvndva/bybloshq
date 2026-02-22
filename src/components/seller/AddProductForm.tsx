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
import { ArrowLeft, X, ImagePlus } from 'lucide-react';

interface ServiceOptions {
  availability_days: string[];
  location_type: 'buyer_visits_seller' | 'seller_visits_buyer' | 'hybrid';
  price_type: 'hourly' | 'fixed';
  start_time: string;
  end_time: string;
}

interface FormData {
  name: string;
  price: string;
  description: string;
  image: File | null;
  image_url: string;
  aesthetic: string;
  is_digital: boolean;
  digital_file: File | null;
  digital_file_name: string;
  digital_file_path: string;
  product_type: 'physical' | 'digital' | 'service';
  service_locations: string;
  service_options: ServiceOptions;
}

export const AddProductForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  // Multi-image state (up to 3 images total including the primary)
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    price: '',
    description: '',
    image: null,
    image_url: '',
    aesthetic: 'noir',
    is_digital: false,
    digital_file: null,
    digital_file_name: '',
    digital_file_path: '',
    product_type: 'physical',
    service_locations: '',
    service_options: {
      availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      location_type: 'buyer_visits_seller',
      price_type: 'fixed',
      start_time: '09:00',
      end_time: '17:00'
    }
  });
  const [sellerProfile, setSellerProfile] = useState<any>(null); // Store full seller profile

  // Get the current seller ID from the API
  const getSellerId = async () => {
    try {
      const seller = await sellerApi.getProfile();
      if (!seller?.id) {
        throw new Error('Invalid seller data. Please log in again.');
      }
      setSellerProfile(seller); // Save profile for shop address logic
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

  // Effect to fetch seller profile on mount
  useState(() => {
    getSellerId();
  });

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

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>, slot: number) => {
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
      const processedImage = await processImage(file);

      if (slot === 0) {
        // Primary image
        setImagePreview(processedImage);
        setFormData(prev => ({ ...prev, image: file, image_url: processedImage }));
      } else {
        // Additional images (slots 1 and 2)
        const idx = slot - 1;
        setExtraFiles(prev => {
          const updated = [...prev];
          updated[idx] = file;
          return updated;
        });
        setExtraPreviews(prev => {
          const updated = [...prev];
          updated[idx] = processedImage;
          return updated;
        });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process image',
        variant: 'destructive',
      });
    }
  };

  const removeImage = (slot: number) => {
    if (slot === 0) {
      setImagePreview('');
      setFormData(prev => ({ ...prev, image: null, image_url: '' }));
    } else {
      const idx = slot - 1;
      setExtraFiles(prev => prev.filter((_, i) => i !== idx));
      setExtraPreviews(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get seller ID first
      const sellerId = await getSellerId();

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

      let digitalFilePath = formData.digital_file_path;
      let digitalFileName = formData.digital_file_name;

      if (formData.is_digital) {
        if (formData.digital_file) {
          try {
            const uploadResult = await sellerApi.uploadDigitalProduct(formData.digital_file);
            digitalFilePath = uploadResult.filePath;
            digitalFileName = uploadResult.fileName;
          } catch (error) {
            console.error('Error uploading digital file:', error);
            toast({
              title: 'Upload Error',
              description: 'Failed to upload digital file. Please try again.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }
        } else if (!digitalFilePath) {
          toast({
            title: 'Digital File Required',
            description: 'Please upload a file for your digital product.',
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
        images: extraPreviews.length > 0 ? extraPreviews : undefined, // Up to 2 extra images
        aesthetic: formData.aesthetic,
        sellerId: sellerId,
        is_digital: formData.is_digital,
        digital_file_path: formData.is_digital ? digitalFilePath : undefined,
        digital_file_name: formData.is_digital ? digitalFileName : undefined,
        product_type: formData.product_type,
        service_locations: formData.product_type === 'service' ? formData.service_locations : undefined,
        service_options: formData.product_type === 'service' ? formData.service_options : undefined,
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
        is_digital: false,
        digital_file: null,
        digital_file_name: '',
        digital_file_path: '',
        product_type: 'physical',
        service_locations: '',
        service_options: {
          availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          location_type: 'buyer_visits_seller',
          price_type: 'fixed',
          start_time: '09:00',
          end_time: '17:00'
        }
      });
      setImagePreview('');
      setExtraFiles([]);
      setExtraPreviews([]);
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

  const resetImages = () => {
    setImagePreview('');
    setFormData(prev => ({ ...prev, image: null, image_url: '' }));
    setExtraFiles([]);
    setExtraPreviews([]);
  };

  // Build the list of all image slots [primary, extra1, extra2]
  const allPreviews = [imagePreview, ...extraPreviews];
  const MAX_IMAGES = 3;
  const canAddMore = allPreviews.filter(Boolean).length < MAX_IMAGES;

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/seller/dashboard')}
            className="inline-flex items-center gap-2 bg-transparent border-white/10 text-gray-200 hover:bg-white/5 hover:border-yellow-400/30 rounded-xl px-4 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-4">Add New Product</h1>
          <p className="text-gray-300 text-lg font-medium">Create a new product listing for your store</p>
        </div>

        <Card className="sm:bg-[rgba(20,20,20,0.7)] sm:backdrop-blur-[12px] sm:border sm:border-white/10 sm:shadow-xl bg-transparent border-0 shadow-none">
          <CardHeader className="pb-6 px-0 sm:px-6">
            <CardTitle className="text-2xl font-black text-white flex items-center">
              <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-400/20 shadow-[0_0_18px_rgba(250,204,21,0.18)] rounded-2xl flex items-center justify-center mr-4">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              Product Information
            </CardTitle>
            <CardDescription className="text-gray-300 font-medium">
              Fill in the details below to create your product listing
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Form Fields... */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Columns content unchanged for now, will flow naturally */}
                <div className="space-y-6">
                  {/* ... Left Column ... */}
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-bold text-gray-300 uppercase tracking-wide">Product Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter product name"
                      required
                      className="h-12 bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="price" className="text-sm font-bold text-gray-300 uppercase tracking-wide">Price (KES)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={handleChange}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="Enter price"
                      required
                      className="h-12 bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-300 uppercase tracking-wide">Product Type</Label>
                    <div className="flex space-x-2 relative">
                      <Button
                        type="button"
                        variant={formData.product_type === 'physical' ? "default" : "outline"}
                        onClick={() => setFormData(prev => ({ ...prev, product_type: 'physical', is_digital: false }))}
                        className={`flex-1 h-12 rounded-xl text-xs sm:text-sm ${formData.product_type === 'physical' ? 'bg-white/5 border border-white/10 text-white' : 'bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white'}`}
                      >
                        Physical
                      </Button>
                      <Button
                        type="button"
                        variant={formData.product_type === 'digital' ? "default" : "outline"}
                        onClick={() => setFormData(prev => ({ ...prev, product_type: 'digital', is_digital: true }))}
                        className={`flex-1 h-12 rounded-xl text-xs sm:text-sm ${formData.product_type === 'digital' ? 'bg-white/5 border border-white/10 text-white' : 'bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white'}`}
                      >
                        Digital
                      </Button>
                      <div className="flex-1 relative group">
                        <Button
                          type="button"
                          variant={formData.product_type === 'service' ? "default" : "outline"}
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              product_type: 'service',
                              is_digital: false,
                              service_locations: sellerProfile?.physicalAddress || '',
                              service_options: {
                                ...prev.service_options,
                                location_type: sellerProfile?.hasPhysicalShop ? 'buyer_visits_seller' : 'seller_visits_buyer'
                              }
                            }));
                          }}
                          className={`w-full h-12 rounded-xl text-xs sm:text-sm ${formData.product_type === 'service' ? 'bg-white/5 border border-white/10 text-white' : 'bg-transparent border-white/10 text-gray-200 hover:bg-white/5 hover:text-white'}`}
                        >
                          Service
                        </Button>
                      </div>
                    </div>
                  </div>

                  {formData.product_type === 'digital' && (
                    <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                      <Label htmlFor="digital_file" className="text-sm font-bold text-gray-300 uppercase tracking-wide">Digital File</Label>
                      <Input
                        id="digital_file"
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormData(prev => ({ ...prev, digital_file: file }));
                          }
                        }}
                        accept=".pdf,.zip,.rar,.epub,.mobi"
                        className="h-12 bg-gray-800 border-gray-700 text-white file:text-gray-200 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl pt-2.5"
                      />
                      <p className="text-xs text-gray-300">Allowed: PDF, ZIP, RAR, EPUB, MOBI (Max 50MB)</p>
                      {formData.digital_file && (
                        <p className="text-sm text-green-200 font-medium">Selected: {formData.digital_file.name}</p>
                      )}
                    </div>
                  )}

                  {formData.product_type === 'service' && (
                    <div className="space-y-6 animate-in fade-in zoom-in duration-300 bg-white/5 p-4 rounded-xl border border-dashed border-white/10">
                      {/* Pricing Model */}
                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-300 uppercase tracking-wide">Pricing Model</Label>
                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            variant={formData.service_options.price_type === 'hourly' ? "default" : "outline"}
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              service_options: { ...prev.service_options, price_type: 'hourly' }
                            }))}
                            className={`flex-1 ${formData.service_options.price_type === 'hourly' ? 'bg-yellow-400/10 text-yellow-200 border border-yellow-400/20 shadow-[0_0_18px_rgba(250,204,21,0.12)]' : 'bg-transparent border border-white/10 text-gray-200 hover:bg-white/5'}`}
                          >
                            Hourly Rate
                          </Button>
                          <Button
                            type="button"
                            variant={formData.service_options.price_type === 'fixed' ? "default" : "outline"}
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              service_options: { ...prev.service_options, price_type: 'fixed' }
                            }))}
                            className={`flex-1 ${formData.service_options.price_type === 'fixed' ? 'bg-yellow-400/10 text-yellow-200 border border-yellow-400/20 shadow-[0_0_18px_rgba(250,204,21,0.12)]' : 'bg-transparent border border-white/10 text-gray-200 hover:bg-white/5'}`}
                          >
                            Fixed Price
                          </Button>
                        </div>
                      </div>

                      {/* Availability Days */}
                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-gray-300 uppercase tracking-wide">Available Days</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <Button
                              key={day}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentDays = formData.service_options.availability_days || [];
                                const newDays = currentDays.includes(day)
                                  ? currentDays.filter(d => d !== day)
                                  : [...currentDays, day];
                                setFormData(prev => ({
                                  ...prev,
                                  service_options: { ...prev.service_options, availability_days: newDays }
                                }));
                              }}
                              className={`rounded-lg transition-all ${(formData.service_options.availability_days || []).includes(day)
                                ? 'bg-yellow-400/10 text-yellow-200 border border-yellow-400/20 shadow-[0_0_14px_rgba(250,204,21,0.12)]'
                                : 'bg-transparent border border-white/10 text-gray-200 hover:bg-white/5'
                                }`}
                            >
                              {day}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Time Availability */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-bold text-gray-300 uppercase tracking-wide">Start Time</Label>
                          <Input
                            type="time"
                            value={formData.service_options.start_time || '09:00'}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              service_options: { ...prev.service_options, start_time: e.target.value }
                            }))}
                            className="h-12 bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-bold text-gray-300 uppercase tracking-wide">End Time</Label>
                          <Input
                            type="time"
                            value={formData.service_options.end_time || '17:00'}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              service_options: { ...prev.service_options, end_time: e.target.value }
                            }))}
                            className="h-12 bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
                          />
                        </div>
                      </div>

                      {/* Location Type */}
                      <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-400/20">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 bg-yellow-500/10 border border-yellow-400/20 p-2 rounded-lg">
                            <svg className="h-5 w-5 text-yellow-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-yellow-100 text-sm">Service Location</h4>
                            {sellerProfile?.hasPhysicalShop ? (
                              <p className="text-yellow-200/80 text-sm mt-1">
                                All services will be performed at your shop address:
                                <br />
                                <span className="font-medium text-white">{sellerProfile?.physicalAddress}</span>
                              </p>
                            ) : (
                              <p className="text-yellow-200/80 text-sm mt-1">
                                You do not have a shop address.
                                <br />
                                <span className="font-medium text-white">Defaulting to Home Service (You visit buyer).</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-sm font-bold text-gray-300 uppercase tracking-wide">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Enter product description"
                      rows={4}
                      required
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-300 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-300 uppercase tracking-wide">Category</Label>
                    <Select
                      value={formData.aesthetic}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, aesthetic: value }))}
                      required
                    >
                      <SelectTrigger className="w-full h-12 bg-gray-800 border-gray-700 text-white focus:border-yellow-400 focus:ring-yellow-400 rounded-xl">
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
                  {/* Multi-Image Upload – up to 3 photos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-gray-300 uppercase tracking-wide">Product Photos</Label>
                      <span className="text-xs text-gray-400">{allPreviews.filter(Boolean).length} / {MAX_IMAGES} photos</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Render up to MAX_IMAGES slots */}
                      {Array.from({ length: MAX_IMAGES }).map((_, slot) => {
                        const preview = allPreviews[slot];
                        const isFirst = slot === 0;
                        const isDisabled = slot > 0 && !allPreviews[slot - 1]; // must fill in order
                        return (
                          <div key={slot} className="relative aspect-square">
                            {preview ? (
                              <>
                                <img
                                  src={preview}
                                  alt={`Photo ${slot + 1}`}
                                  className="w-full h-full object-cover rounded-xl border-2 border-white/10"
                                />
                                {isFirst && (
                                  <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-yellow-400/90 text-black px-1.5 py-0.5 rounded-md">Main</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeImage(slot)}
                                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center shadow-md transition-colors z-10"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <label
                                className={`w-full h-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors duration-200 ${isDisabled
                                    ? 'border-white/5 bg-white/[0.02] cursor-not-allowed opacity-40'
                                    : 'border-white/20 bg-white/5 hover:border-yellow-400/40 hover:bg-yellow-400/5 cursor-pointer'
                                  }`}
                              >
                                <ImagePlus className={`h-6 w-6 mb-1 ${isDisabled ? 'text-gray-600' : 'text-gray-400'}`} />
                                <span className={`text-[10px] font-medium ${isDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                                  {isFirst ? 'Main photo' : `Photo ${slot + 1}`}
                                </span>
                                {!isDisabled && (
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => handleImageChange(e, slot)}
                                  />
                                )}
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400">PNG, JPG up to 5MB each. First photo is shown as the main image.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:space-x-4 pt-8 border-t border-white/10">
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
                      is_digital: false,
                      digital_file: null,
                      digital_file_name: '',
                      digital_file_path: '',
                      product_type: 'physical',
                      service_locations: '',
                      service_options: {
                        availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                        location_type: 'buyer_visits_seller',
                        price_type: 'fixed',
                        start_time: '09:00',
                        end_time: '17:00'
                      }
                    });
                    resetImages();
                  }}
                  disabled={isLoading}
                  className="w-full sm:w-auto h-12 px-8 bg-transparent border-white/10 text-gray-200 hover:bg-white/5 hover:border-yellow-400/30 transition-all duration-200 rounded-xl font-semibold sm:mr-4"
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto h-12 px-8 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg rounded-xl font-semibold"
                >
                  {isLoading ? 'Adding...' : 'Add Product'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div >
  );
}

export default AddProductForm;
