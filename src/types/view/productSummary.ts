export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  imageUrl?: string;
  aesthetic: string;
  createdAt: string;
  updatedAt?: string;
  sold?: number;
  status?: 'available' | 'sold';
  isSold?: boolean;
}


