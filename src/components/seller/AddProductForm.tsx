import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { isSellerShopless } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { sellerApi } from '@/api/sellerApi';
import { aestheticCategories } from '../AestheticCategories';
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
import { cn } from '@/lib/utils';

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
  digital_file_size: number | null;
  product_type: 'physical' | 'digital' | 'service';
  service_options: ServiceOptions;
  is_custom_product: boolean;
  production_days: string;
  customization_prompt: string;
}

const formDataDefaults: FormData = {
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
  service_options: {
    availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    location_type: 'buyer_visits_seller',
    price_type: 'fixed',
    start_time: '09:00',
    end_time: '17:00'
  }
};

export const AddProductForm = ({ onSuccess, onClose }: { onSuccess: () => void; onClose?: () => void }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({ ...formDataDefaults });
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fileError, setFileError] = useState<string>('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const seller = await sellerApi.getProfile();
        setSellerProfile(seller);
      } catch (error) {
        console.error('Error getting seller profile:', error);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'description' && value.length > 300) return;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const processImage = async (file: File): Promise<string> => {
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

  const allPreviewsCombined = () => [imagePreview, ...extraPreviews].filter(Boolean);

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
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      let digitalFilePath = formData.digital_file_path;
      let digitalFileName = formData.digital_file_name;
      let digitalFileSize = formData.digital_file_size;

      if (formData.is_digital && formData.digital_file) {
        const res = await sellerApi.uploadDigitalProduct(formData.digital_file, setUploadProgress);
        digitalFilePath = res.filePath;
        digitalFileName = res.fileName;
        digitalFileSize = res.size;
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
        digital_file_path: digitalFilePath,
        digital_file_name: digitalFileName,
        digital_file_size: digitalFileSize,
        service_options: formData.product_type === 'service' ? formData.service_options : undefined,
      };

      await sellerApi.createProduct(productData);
      toast({ title: 'Success', description: 'Product launched successfully!' });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to create product', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-xl font-bold text-white">Let's start with the basics</h2>
        <p className="text-white text-sm">What are you selling today?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: 'physical', label: 'Physical', icon: Package, desc: 'Shippable goods' },
          { id: 'digital', label: 'Digital', icon: FileText, desc: 'Downloads, Keys' },
          { id: 'service', label: 'Service', icon: Sparkles, desc: 'Bookings, Tasks' }
        ].map(type => (
          <button
            key={type.id}
            type="button"
            onClick={() => setFormData(p => ({ ...p, product_type: type.id as any, is_digital: type.id === 'digital' }))}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 text-center group",
              formData.product_type === type.id
                ? "bg-yellow-400/10 border-yellow-400 text-white shadow-[0_0_20px_rgba(250,204,21,0.1)]"
                : "bg-white/5 border-white/10 text-white hover:border-white/20 hover:bg-white/10"
            )}
          >
            <type.icon className={cn("h-8 w-8 mb-2 group-hover:scale-110 transition-transform", formData.product_type === type.id ? "text-white" : "text-white")} />
            <span className="font-bold text-sm">{type.label}</span>
            <span className="text-[10px] opacity-60 mt-1">{type.desc}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-white uppercase">Product Name</Label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Vintage Leather Watch"
            className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:ring-yellow-400"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold text-white uppercase">Category</Label>
          <Select value={formData.aesthetic} onValueChange={v => setFormData(p => ({ ...p, aesthetic: v }))}>
            <SelectTrigger className="h-12 bg-white/5 border-white/10 text-white rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100] rounded-xl border-yellow-400/40 bg-zinc-950 text-white shadow-2xl shadow-black/70">
              {aestheticCategories.map(c => (
                <SelectItem
                  key={c.id}
                  value={c.id}
                  className="text-white focus:bg-yellow-400 focus:text-black data-[state=checked]:bg-yellow-400/15 data-[state=checked]:text-yellow-100"
                >
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-xl font-bold text-white">Visuals & Story</h2>
        <p className="text-white text-sm">Make your product stand out with photos.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(slot => {
          const preview = slot === 0 ? imagePreview : extraPreviews[slot - 1];
          const combined = allPreviewsCombined();
          const isDisabled = slot > 0 && !combined[slot - 1];
          return (
            <div key={slot} className="relative aspect-square">
              {preview ? (
                <div className="relative h-full w-full">
                  <img src={preview} alt="slot" className="h-full w-full object-cover rounded-2xl border-2 border-yellow-400/50" />
                  <button onClick={() => {
                    if (slot === 0) { setImagePreview(''); setFormData(p => ({ ...p, image: null, image_url: '' })); }
                    else { setExtraPreviews(p => p.filter((_, i) => i !== slot - 1)); setExtraFiles(p => p.filter((_, i) => i !== slot - 1)); }
                  }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"><X className="h-3 w-3 text-white" /></button>
                </div>
              ) : (
                <label className={cn(
                  "flex flex-col items-center justify-center h-full border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                  isDisabled ? "opacity-30 cursor-not-allowed border-white/5" : "border-white/10 hover:border-yellow-400/50 hover:bg-white/5"
                )}>
                  {!isDisabled && <input type="file" className="hidden" onChange={e => handleImageChange(e, slot)} accept="image/*" />}
                  <ImagePlus className="h-6 w-6 text-white mb-1" />
                  <span className="text-[10px] text-white">{slot === 0 ? "Main" : "Extra"}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-bold text-white uppercase">Description</Label>
            <span className="text-[10px] text-white">{formData.description.length}/300</span>
          </div>
          <Textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe what makes this product special..."
            className="bg-white/5 border-white/10 text-white rounded-xl min-h-[100px] focus:ring-yellow-400"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-xl font-bold text-white">{formData.product_type.charAt(0).toUpperCase() + formData.product_type.slice(1)} Details</h2>
        <p className="text-white text-sm">Specific information for this type of product.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-white uppercase">Price (KES)</Label>
          <Input
            type="number"
            name="price"
            min={50}
            value={formData.price}
            onChange={handleChange}
            placeholder="0.00"
            className="h-12 bg-white/5 border-white/10 text-white rounded-xl focus:ring-yellow-400"
          />
        </div>

        {formData.product_type === 'digital' && (
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
            <Label className="text-xs font-bold text-yellow-400 uppercase">Upload Digital Content</Label>
            <div className="relative">
              <Input
                type="file"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setFormData(p => ({ ...p, digital_file: file }));
                }}
                className="bg-white/5 border-white/10 text-white h-12 pt-2.5 rounded-xl"
              />
              {uploadProgress > 0 && (
                <div className="mt-2 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
          </div>
        )}

        {formData.product_type === 'service' && (
          <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-white uppercase">Start Time</Label>
                <Input type="time" value={formData.service_options.start_time} onChange={e => setFormData(p => ({ ...p, service_options: { ...p.service_options, start_time: e.target.value } }))} className="bg-white/5 border-white/10 text-white rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-white uppercase">End Time</Label>
                <Input type="time" value={formData.service_options.end_time} onChange={e => setFormData(p => ({ ...p, service_options: { ...p.service_options, end_time: e.target.value } }))} className="bg-white/5 border-white/10 text-white rounded-xl" />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    const days = formData.service_options.availability_days;
                    const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
                    setFormData(p => ({ ...p, service_options: { ...p.service_options, availability_days: newDays } }));
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    formData.service_options.availability_days.includes(day) ? "bg-white/15 text-white border border-white/20" : "bg-white/5 text-white border border-white/10"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {formData.product_type === 'physical' && (
          <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-xs font-bold text-white uppercase">Custom product</span>
                <span className="block text-[11px] text-white/70">Buyer must submit custom instructions before payment.</span>
              </span>
              <input
                type="checkbox"
                checked={formData.is_custom_product}
                onChange={event => setFormData(p => ({ ...p, is_custom_product: event.target.checked }))}
                className="h-5 w-5 accent-yellow-400"
              />
            </label>

            {formData.is_custom_product && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-white uppercase">Production days</Label>
                  <Select value={formData.production_days} onValueChange={value => setFormData(p => ({ ...p, production_days: value }))}>
                    <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] rounded-xl border-yellow-400/40 bg-zinc-950 text-white shadow-2xl shadow-black/70">
                      {[1, 2, 3, 4, 5].map(day => (
                        <SelectItem key={day} value={String(day)} className="text-white focus:bg-yellow-400 focus:text-black">
                          {day} {day === 1 ? 'day' : 'days'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-white uppercase">Buyer instruction prompt</Label>
                  <Textarea
                    value={formData.customization_prompt}
                    onChange={event => setFormData(p => ({ ...p, customization_prompt: event.target.value }))}
                    className="bg-white/5 border-white/10 text-white rounded-xl min-h-[72px] focus:ring-yellow-400"
                    placeholder="Tell the seller exactly what you want customized."
                  />
                </div>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
                  Buyers will see: Made in up to {formData.production_days} {Number(formData.production_days) === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {formData.product_type === 'digital' && (
        <div className="flex items-start gap-3 p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-xl">
          <Info className="h-4 w-4 text-yellow-400 mt-0.5" />
          <p className="text-[10px] text-yellow-100 opacity-80 leading-relaxed">
            Note: <strong>Digital products</strong> are typically assets like PDFs, Music, or Software. If you are selling a Physical Item (e.g. Headphones), please use the Physical type.
          </p>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-xl font-bold text-white">Review & Publish</h2>
        <p className="text-white text-sm">Everything look correct?</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
        <div className="aspect-video relative">
          <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">{formData.product_type}</span>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-bold text-white">{formData.name}</h3>
            <span className="text-xl font-black text-yellow-400">KES {formData.price}</span>
          </div>
          <p className="text-sm text-white line-clamp-2">{formData.description}</p>
          <div className="flex items-center gap-2 pt-2 text-[10px] text-white uppercase font-bold">
            <MapPin className="h-3 w-3" />
            <span>{sellerProfile?.city || 'Your Shop'}</span>
            <span>•</span>
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>Safe Checkout</span>
          </div>
          {formData.product_type === 'physical' && formData.is_custom_product && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-800">
              Custom product: made in up to {formData.production_days} {Number(formData.production_days) === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-black sm:bg-transparent overflow-hidden">
      {/* Header with Progress Bar */}
      <div className="px-6 pt-6 pb-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest bg-yellow-400/10 px-2 py-1 rounded">Step {step} of 4</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              step >= s ? "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]" : "bg-white/10"
            )} />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Footer Navigation */}
      <div className="p-6 border-t border-white/10 flex justify-between items-center gap-4 bg-black/40 backdrop-blur-xl">
        {step > 1 ? (
          <Button
            variant="outline"
            onClick={prevStep}
            className="flex-1 h-12 bg-transparent border-white/10 text-white rounded-xl hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        ) : (
          <div className="flex-1" />
        )}

        {step < 4 ? (
          <Button
            onClick={nextStep}
            className="flex-[2] h-12 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl border border-white/15"
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-[2] h-12 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl border border-white/15"
          >
            {isLoading ? "Launching..." : "Launch Product"}
            <Sparkles className="h-4 w-4 ml-2 fill-current" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default AddProductForm;
