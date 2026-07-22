import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { isSellerShopless, cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sellerApi } from '@/api/seller';
import { aestheticCategories } from '../aestheticCategoriesData';
import { useSellerProfileQuery } from '@/hooks/seller/useSellerProfile';
import { useCreateProductMutation, useUploadDigitalProductMutation } from '@/hooks/seller/useSellerProducts';
import { AddProductFormSteps } from './AddProductFormSteps';
import { formDataDefaults, processImage, type AddProductFormData } from './addProductFormUtils';
import {
  ArrowLeft,
  ArrowRight,
  X,
  ImagePlus,
  Package,
  FileText,
  Sparkles,
  Info,
  CheckCircle2,
  Clock,
  MapPin
} from 'lucide-react';

export const AddProductForm = ({ onSuccess, onClose }: { onSuccess: () => void; onClose?: () => void }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState<AddProductFormData>({ ...formDataDefaults });
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fileError, setFileError] = useState<string>('');

  const { data: sellerProfile = null } = useSellerProfileQuery();

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'description' && value.length > 300) return;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum image size is 10MB', variant: 'destructive' });
      return;
    }

    try {
      const processedImage = await processImage(file);
      if (slot === 0) {
        setImagePreview(processedImage);
        setFormData(prev => ({ ...prev, image: file, image_url: processedImage }));
      } else {
        const idx = slot - 1;
        setExtraFiles(prev => { const n = [...prev]; n[idx] = file; return n; });
        setExtraPreviews(prev => { const n = [...prev]; n[idx] = processedImage; return n; });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to process image', variant: 'destructive' });
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.name.trim() || !formData.product_type) {
        toast({ title: 'Missing Info', description: 'Please name your product and select a type.', variant: 'destructive' });
        return;
      }
    }
    if (step === 2) {
      if (!imagePreview) {
        toast({ title: 'Photo Required', description: 'Please add at least one photo.', variant: 'destructive' });
        return;
      }
      if (!formData.description.trim()) {
        toast({ title: 'Description Required', description: 'Please add a short description.', variant: 'destructive' });
        return;
      }
    }
    if (step === 3 && formData.product_type === 'physical' && formData.is_custom_product) {
      const days = Number.parseInt(formData.production_days, 10);
      if (!Number.isInteger(days) || days < 1 || days > 5) {
        toast({ title: 'Production days required', description: 'Select a production time from 1 to 5 days.', variant: 'destructive' });
        return;
      }
      if (!formData.customization_prompt.trim()) {
        toast({ title: 'Prompt required', description: 'Add the question buyers should answer for this custom product.', variant: 'destructive' });
        return;
      }
    }
    if (step === 3 && formData.product_type === 'physical' && formData.is_imported_product) {
      const days = Number.parseInt(formData.import_days, 10);
      if (![7, 14, 21, 30].includes(days)) {
        toast({ title: 'Import ready time required', description: 'Select 7, 14, 21, or 30 days.', variant: 'destructive' });
        return;
      }
    }
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const createProductMutation = useCreateProductMutation();
  const uploadDigitalProductMutation = useUploadDigitalProductMutation();

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      let digitalFilePath = formData.digital_file_path;
      let digitalFileName = formData.digital_file_name;
      let digitalFileSize = formData.digital_file_size;

      if (formData.is_digital && formData.digital_file) {
        const res = await uploadDigitalProductMutation.mutateAsync({
          file: formData.digital_file,
          onProgress: setUploadProgress
        }) as Record<string, unknown>;
        digitalFilePath = String(res.filePath);
        digitalFileName = String(res.fileName);
        digitalFileSize = Number(res.size);
      }

      const priceFloat = parseFloat(formData.price || '0');
      if (priceFloat < 50) {
        toast({ title: 'Invalid Price', description: 'Minimum price must be KES 50', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const productData = {
        name: formData.name,
        price: priceFloat,
        description: formData.description,
        image_url: formData.image_url,
        images: extraPreviews,
        aesthetic: formData.aesthetic,
        sellerId: sellerProfile?.id,
        is_digital: formData.product_type === 'digital',
        product_type: formData.product_type,
        is_custom_product: formData.product_type === 'physical' ? formData.is_custom_product : false,
        production_days: formData.product_type === 'physical' && formData.is_custom_product ? Number.parseInt(formData.production_days, 10) : null,
        customization_prompt: formData.product_type === 'physical' && formData.is_custom_product ? formData.customization_prompt : null,
        is_imported_product: formData.product_type === 'physical' ? formData.is_imported_product : false,
        import_days: formData.product_type === 'physical' && formData.is_imported_product ? Number.parseInt(formData.import_days, 10) : null,
        import_note: formData.product_type === 'physical' && formData.is_imported_product ? formData.import_note : null,
        digital_file_path: digitalFilePath,
        digital_file_name: digitalFileName,
        digital_file_size: digitalFileSize,
        service_options: formData.product_type === 'service' ? formData.service_options : undefined,
      };

      await createProductMutation.mutateAsync(productData as unknown as Parameters<typeof createProductMutation.mutateAsync>[0]);
      toast({ title: 'Success', description: 'Product launched successfully!' });
      onSuccess();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to create product', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-slate-950 dark:text-white">
      {/* Header with Progress Bar */}
      <div className="shrink-0 space-y-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:space-y-4 sm:px-6 sm:pt-6 sm:pb-4">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase text-yellow-600 dark:text-yellow-400 tracking-widest bg-yellow-400/20 px-2 py-1 rounded">Step {step} of 4</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-slate-200 dark:hover:bg-white/10">
              <X className="h-5 w-5 text-slate-700 dark:text-white" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              step >= s ? "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]" : "bg-slate-200 dark:bg-white/10"
            )} />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
        <AddProductFormSteps
          step={step}
          formData={formData}
          setFormData={setFormData}
          handleChange={handleChange}
          imagePreview={imagePreview}
          setImagePreview={setImagePreview}
          extraPreviews={extraPreviews}
          setExtraPreviews={setExtraPreviews}
          setExtraFiles={setExtraFiles}
          handleImageChange={handleImageChange}
          uploadProgress={uploadProgress}
          sellerProfile={sellerProfile}
        />
      </div>

      {/* Footer Navigation */}
      <div className="shrink-0 border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
        {step > 1 ? (
          <Button
            variant="outline"
            onClick={prevStep}
            className="h-11 flex-1 rounded-xl border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-white/5 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 sm:h-12"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4 sm:mr-2" />
            Back
          </Button>
        ) : (
          <div className="flex-1" />
        )}

        {step < 4 ? (
          <Button
            onClick={nextStep}
            className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black text-sm font-black shadow-md sm:h-12 transition-all duration-200"
          >
            Continue
            <ArrowRight className="ml-1.5 h-4 w-4 sm:ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black text-sm font-black shadow-md sm:h-12 transition-all duration-200"
          >
            {isLoading ? "Launching..." : "Launch Product"}
            <Sparkles className="ml-1.5 h-4 w-4 fill-current sm:ml-2" />
          </Button>
        )}
        </div>
      </div>
    </div>
  );
};

export default AddProductForm;


