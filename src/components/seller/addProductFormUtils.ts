export interface ServiceOptions {
  availability_days: string[];
  location_type: 'buyer_visits_seller' | 'seller_visits_buyer' | 'hybrid';
  price_type: 'hourly' | 'fixed';
  start_time: string;
  end_time: string;
}

export interface AddProductFormData {
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
  digital_file_size: number | null;
  product_type: 'physical' | 'digital' | 'service';
  service_options: ServiceOptions;
  is_custom_product: boolean;
  production_days: string;
  customization_prompt: string;
  is_imported_product: boolean;
  import_days: string;
  import_note: string;
}

export const formDataDefaults: AddProductFormData = {
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
  digital_file_size: null,
  product_type: 'physical',
  is_custom_product: false,
  production_days: '1',
  customization_prompt: 'Tell the seller exactly what you want customized.',
  is_imported_product: false,
  import_days: '14',
  import_note: 'Imported item. Delivery starts after seller handoff.',
  service_options: {
    availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    location_type: 'buyer_visits_seller',
    price_type: 'fixed',
    start_time: '09:00',
    end_time: '17:00'
  }
};

export const processImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas error'));
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
