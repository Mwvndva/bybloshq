
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Package, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sellerApi } from '@/api/sellerApi';
import { useNavigate } from 'react-router-dom';
import { Aesthetic } from '@/types';
import { aestheticCategories } from '../AestheticCategories';

interface ProductUploadProps {
  onSuccess: () => void;
}

const ProductUpload = ({ onSuccess }: ProductUploadProps) => {
  const [formData, setFormData] = useState({
    name: '',
    aesthetic: '',
    description: '',
    price: '',
    image: null as File | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleAestheticChange = (value: string) => {
    setFormData(prev => ({ ...prev, aesthetic: value }));
  };

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.image) {
      toast({
        title: 'Error',
        description: 'Please select an image for the product',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // First upload the image to get a URL
      const formDataToSend = new FormData();
      formDataToSend.append('image', formData.image);
      
      // In a real app, you would upload the image to a storage service first
      // For now, we'll just use a placeholder URL
      const imageUrl = URL.createObjectURL(formData.image);
      
      // Get the seller's profile to get their ID
      const sellerProfile = await sellerApi.getProfile();
      const sellerId = sellerProfile.id;
      
      // Create the product with the image URL and seller ID
      const productData = {
        name: formData.name,
        price: parseFloat(formData.price),
        description: formData.description,
        aesthetic: formData.aesthetic,
        image_url: imageUrl,
        sellerId: sellerId.toString(), // Ensure sellerId is a string
      };

      await sellerApi.createProduct(productData);
      
      toast({
        title: 'Success',
        description: 'Product added successfully!',
      });
      
      // Reset form with default aesthetic
      setFormData({
        name: '',
        price: '',
        description: '',
        aesthetic: 'afro-futuristic', // Set a default aesthetic
        image: null,
      });
      setImagePreview(null);
      
      // Navigate to dashboard on success
      onSuccess();
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: 'Error',
        description: 'Failed to add product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
    onSuccess();
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="font-serif text-2xl text-noir flex items-center justify-center space-x-2">
          <Package className="w-6 h-6" />
          <span>Upload New Product</span>
        </CardTitle>
        <p className="text-gray-600">
          Share your curated piece with the Byblos community
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter product name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aesthetic">Aesthetic</Label>
            <Select 
              onValueChange={handleAestheticChange} 
              value={formData.aesthetic}
              required
            >
              <SelectTrigger className="w-full">
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your product..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price" className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4" />
              <span>Price</span>
            </Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={handleInputChange}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image" className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Product Image</span>
            </Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="cursor-pointer"
              required
            />
            {imagePreview && (
              <div className="mt-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-w-xs mx-auto rounded-lg shadow-sm"
                />
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-noir hover:bg-noir-light text-white"
            disabled={isLoading}
          >
            {isLoading ? 'Uploading Product...' : 'Upload Product'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProductUpload;
