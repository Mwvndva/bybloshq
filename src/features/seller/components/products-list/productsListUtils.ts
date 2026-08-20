import type { ProductEditFormData } from './ProductEditDialog';

export const createInitialEditFormData = (): ProductEditFormData => ({
  name: '',
  price: '',
  description: '',
  aesthetic: 'afro-futuristic',
  image: null,
  imagePreview: '',
  extraFiles: [],
  extraPreviews: [],
  product_type: 'physical',
  is_custom_product: false,
  production_days: '1',
  customization_prompt: 'Tell the seller exactly what you want customized.',
  is_imported_product: false,
  import_days: '14',
  import_note: 'Imported item. Delivery starts after seller handoff.'
});

export const processImage = async (file: File): Promise<string> => {
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
            const MAX_SIZE_KB = 500;

            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.9;
            let imageDataUrl: string;

            do {
              imageDataUrl = canvas.toDataURL('image/jpeg', quality);
              const sizeKB = (imageDataUrl.length * 0.75) / 1024;
              if (sizeKB <= MAX_SIZE_KB || quality <= 0.5) break;
              quality -= 0.1;
            } while (quality >= 0.5);

            resolve(imageDataUrl);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        if (event.target?.result) {
          img.src = event.target.result as string;
        } else {
          reject(new Error('Failed to read file'));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};
