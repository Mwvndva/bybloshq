import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { isNativeApp } from '@/lib/mobileApp';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { aestheticCategories } from '../aestheticCategoriesData';
import { Package, FileText, Sparkles, X, ImagePlus, Info, MapPin, CheckCircle2 } from 'lucide-react';
import type { AddProductFormData } from './addProductFormUtils';

interface AddProductFormStepsProps {
  step: number;
  formData: AddProductFormData;
  setFormData: Dispatch<SetStateAction<AddProductFormData>>;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  imagePreview: string;
  setImagePreview: Dispatch<SetStateAction<string>>;
  extraPreviews: string[];
  setExtraPreviews: Dispatch<SetStateAction<string[]>>;
  setExtraFiles: Dispatch<SetStateAction<File[]>>;
  handleImageChange: (e: ChangeEvent<HTMLInputElement>, slot: number) => void;
  uploadProgress: number;
  sellerProfile: { city?: string | null } | null | undefined;
}

export const AddProductFormSteps = ({
  step,
  formData,
  setFormData,
  handleChange,
  imagePreview,
  setImagePreview,
  extraPreviews,
  setExtraPreviews,
  setExtraFiles,
  handleImageChange,
  uploadProgress,
  sellerProfile,
}: AddProductFormStepsProps) => {
  const allPreviewsCombined = () => [imagePreview, ...extraPreviews].filter(Boolean);

  const renderStep1 = () => (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">Let's start with the basics</h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">What are you selling today?</p>
      </div>

      <div className={cn("grid gap-2 sm:gap-4", isNativeApp() ? "grid-cols-2" : "grid-cols-3")}>
        {[
          { id: 'physical', label: 'Physical', icon: Package, desc: 'Shippable goods' },
          { id: 'digital', label: 'Digital', icon: FileText, desc: 'Downloads, Keys' },
          { id: 'service', label: 'Service', icon: Sparkles, desc: 'Bookings, Tasks' }
        ].filter(type => !(isNativeApp() && type.id === 'digital')).map(type => (
          <button
            key={type.id}
            type="button"
            onClick={() => setFormData(p => ({ ...p, product_type: type.id as 'physical' | 'digital' | 'service', is_digital: type.id === 'digital' }))}
            className={cn(
              "flex min-h-[92px] flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition-all duration-300 group sm:min-h-[120px] sm:p-4",
              formData.product_type === type.id
                ? "bg-yellow-400/20 border-yellow-500 text-slate-950 dark:text-white shadow-[0_0_20px_rgba(250,204,21,0.15)] font-bold"
                : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white/80 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-200/60 dark:hover:bg-white/10"
            )}
          >
            <type.icon className={cn("h-6 w-6 mb-2 transition-transform group-hover:scale-110 sm:h-8 sm:w-8", formData.product_type === type.id ? "text-yellow-600 dark:text-yellow-400" : "text-slate-600 dark:text-white/60")} />
            <span className="text-xs font-bold sm:text-sm">{type.label}</span>
            <span className="mt-1 hidden text-[10px] opacity-70 sm:block">{type.desc}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4 pt-2 sm:pt-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Product Name</Label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Vintage Leather Watch"
            className="h-12 bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl focus:ring-yellow-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Category</Label>
          <Select value={formData.aesthetic} onValueChange={v => setFormData(p => ({ ...p, aesthetic: v }))}>
            <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100] rounded-xl border-slate-200 dark:border-yellow-400/40 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white shadow-2xl">
              {aestheticCategories.map(c => (
                <SelectItem
                  key={c.id}
                  value={c.id}
                  className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black data-[state=checked]:bg-yellow-400/20 data-[state=checked]:text-slate-950 dark:data-[state=checked]:text-yellow-100"
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
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">Visuals & Story</h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">Make your product stand out with photos.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map(slot => {
          const preview = slot === 0 ? imagePreview : extraPreviews[slot - 1];
          const combined = allPreviewsCombined();
          const isDisabled = slot > 0 && !combined[slot - 1];
          return (
            <div key={slot} className="relative aspect-square">
              {preview ? (
                <div className="relative h-full w-full">
                  <img src={preview} alt="slot" className="h-full w-full object-cover rounded-2xl border-2 border-yellow-400" />
                  <button onClick={() => {
                    if (slot === 0) { setImagePreview(''); setFormData(p => ({ ...p, image: null, image_url: '' })); }
                    else { setExtraPreviews(p => p.filter((_, i) => i !== slot - 1)); setExtraFiles(p => p.filter((_, i) => i !== slot - 1)); }
                  }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"><X className="h-3 w-3 text-white" /></button>
                </div>
              ) : (
                <label className={cn(
                  "flex flex-col items-center justify-center h-full border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                  isDisabled ? "opacity-30 cursor-not-allowed border-slate-200 dark:border-white/5" : "border-slate-300 dark:border-white/10 hover:border-yellow-500 hover:bg-slate-100 dark:hover:bg-white/5 bg-slate-50 dark:bg-white/5"
                )}>
                  {!isDisabled && <input type="file" className="hidden" onChange={e => handleImageChange(e, slot)} accept="image/*" />}
                  <ImagePlus className="mb-1 h-5 w-5 text-slate-700 dark:text-white sm:h-6 sm:w-6" />
                  <span className="text-[10px] font-bold text-slate-700 dark:text-white">{slot === 0 ? "Main" : "Extra"}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Description</Label>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formData.description.length}/300</span>
          </div>
          <Textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe what makes this product special..."
            className="bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl min-h-[100px] focus:ring-yellow-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{formData.product_type.charAt(0).toUpperCase() + formData.product_type.slice(1)} Details</h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">Specific information for this type of product.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Price (KES)</Label>
          <Input
            type="number"
            name="price"
            min={50}
            value={formData.price}
            onChange={handleChange}
            placeholder="0.00"
            className="h-12 bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl focus:ring-yellow-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {formData.product_type === 'digital' && (
          <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl space-y-3">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Upload Digital Content</Label>
            <div className="relative">
              <Input
                type="file"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setFormData(p => ({ ...p, digital_file: file }));
                }}
                className="bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white h-12 pt-2.5 rounded-xl"
              />
              {uploadProgress > 0 && (
                <div className="mt-2 h-1.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
          </div>
        )}

        {formData.product_type === 'service' && (
          <div className="space-y-4 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Start Time</Label>
                <Input type="time" value={formData.service_options.start_time} onChange={e => setFormData(p => ({ ...p, service_options: { ...p.service_options, start_time: e.target.value } }))} className="bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">End Time</Label>
                <Input type="time" value={formData.service_options.end_time} onChange={e => setFormData(p => ({ ...p, service_options: { ...p.service_options, end_time: e.target.value } }))} className="bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl" />
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
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    formData.service_options.availability_days.includes(day) ? "bg-yellow-400 text-black shadow-sm" : "bg-slate-200 dark:bg-white/5 text-slate-800 dark:text-white border border-slate-300 dark:border-white/10"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {formData.product_type === 'physical' && (
          <div className="space-y-4 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl sm:p-4">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white uppercase">Custom product</span>
                <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">Buyer must submit custom instructions before payment.</span>
              </span>
              <input
                type="checkbox"
                checked={formData.is_custom_product}
                onChange={event => setFormData(p => ({
                  ...p,
                  is_custom_product: event.target.checked,
                  is_imported_product: event.target.checked ? false : p.is_imported_product
                }))}
                className="h-5 w-5 accent-yellow-400"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white uppercase">Imported / pre-order item</span>
                <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">Buyer sees the estimated ready time before paying.</span>
              </span>
              <input
                type="checkbox"
                checked={formData.is_imported_product}
                onChange={event => setFormData(p => ({
                  ...p,
                  is_imported_product: event.target.checked,
                  is_custom_product: event.target.checked ? false : p.is_custom_product
                }))}
                className="h-5 w-5 accent-yellow-400"
              />
            </label>

            {formData.is_custom_product && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Production days</Label>
                  <Select value={formData.production_days} onValueChange={value => setFormData(p => ({ ...p, production_days: value }))}>
                    <SelectTrigger className="h-11 bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] rounded-xl border-slate-200 dark:border-yellow-400/40 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white shadow-2xl">
                      {[1, 2, 3, 4, 5].map(day => (
                        <SelectItem key={day} value={String(day)} className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black">
                          {day} {day === 1 ? 'day' : 'days'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Buyer instruction prompt</Label>
                  <Textarea
                    value={formData.customization_prompt}
                    onChange={event => setFormData(p => ({ ...p, customization_prompt: event.target.value }))}
                    className="bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl min-h-[72px] focus:ring-yellow-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Tell the seller exactly what you want customized."
                  />
                </div>
                <p className="rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
                  Buyers will see: Made in up to {formData.production_days} {Number(formData.production_days) === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
                </p>
              </div>
            )}

            {formData.is_imported_product && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">Estimated ready time</Label>
                  <Select value={formData.import_days} onValueChange={value => setFormData(p => ({ ...p, import_days: value }))}>
                    <SelectTrigger className="h-11 bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-950 dark:text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] rounded-xl border-slate-200 dark:border-yellow-400/40 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white shadow-2xl">
                      {[7, 14, 21, 30].map(day => (
                        <SelectItem key={day} value={String(day)} className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black">
                          {day} days
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
                  Buyers will see: Imported item, ready in up to {formData.import_days} days. Delivery starts after seller handoff.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {formData.product_type === 'digital' && (
        <div className="flex items-start gap-3 p-3 bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40 rounded-xl">
          <Info className="h-4 w-4 text-amber-700 dark:text-amber-400 mt-0.5" />
          <p className="text-[11px] font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
            Note: <strong>Digital products</strong> are typically assets like PDFs, Music, or Software. If you are selling a Physical Item (e.g. Headphones), please use the Physical type.
          </p>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">Review & Publish</h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">Everything look correct?</p>
      </div>

      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl sm:rounded-[2rem] overflow-hidden">
        <div className="relative aspect-[4/3] sm:aspect-video">
          <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">{formData.product_type}</span>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="break-words text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{formData.name}</h3>
            <span className="shrink-0 text-lg font-black text-yellow-600 dark:text-yellow-400 sm:text-xl">KES {formData.price}</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{formData.description}</p>
          <div className="flex items-center gap-2 pt-2 text-[10px] text-slate-700 dark:text-white uppercase font-bold">
            <MapPin className="h-3 w-3 text-slate-600 dark:text-white" />
            <span>{sellerProfile?.city || 'Your Shop'}</span>
            <span>•</span>
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500" />
            <span>Safe Checkout</span>
          </div>
          {formData.product_type === 'physical' && formData.is_custom_product && (
            <p className="rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
              Custom product: made in up to {formData.production_days} {Number(formData.production_days) === 1 ? 'day' : 'days'}. Delivery starts after seller handoff.
            </p>
          )}
          {formData.product_type === 'physical' && formData.is_imported_product && (
            <p className="rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
              Imported item: ready in up to {formData.import_days} days. Delivery starts after seller handoff.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </>
  );
};
