import type { ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { aestheticCategories } from '../../aestheticCategoriesData';
import { ProductEditPhysicalOptions } from './ProductEditPhysicalOptions';

export interface ProductEditFormData {
  name: string;
  price: string;
  description: string;
  aesthetic: string;
  image: File | null;
  imagePreview: string;
  extraFiles: File[];
  extraPreviews: string[];
  product_type?: 'physical' | 'digital' | 'service';
  is_custom_product: boolean;
  production_days: string;
  customization_prompt: string;
  is_imported_product: boolean;
  import_days: string;
  import_note: string;
}

interface ProductEditDialogProps {
  open: boolean;
  formData: ProductEditFormData;
  isLoading: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: ProductEditFormData) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>, slot: number) => void;
  onRemoveImage: (slot: number) => void;
  onSave: () => void;
}

export function ProductEditDialog({
  open,
  formData,
  isLoading,
  isSaving,
  onOpenChange,
  onFormDataChange,
  onImageChange,
  onRemoveImage,
  onSave
}: ProductEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 text-slate-950 dark:text-white w-[90vw] max-w-sm sm:max-w-[400px] max-h-[78dvh] overflow-y-auto p-3 sm:p-4 rounded-xl shadow-2xl">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0 text-left mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 -ml-1 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">Edit Product</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-300 text-[10px] sm:text-xs font-medium">
              Update product information
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-name" className="text-slate-800 dark:text-slate-200 text-xs font-semibold">Product Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(event) => onFormDataChange({ ...formData, name: event.target.value })}
                  className="bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-white/20 text-slate-950 dark:text-white h-9 text-sm rounded-lg placeholder:text-slate-400"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <Label htmlFor="edit-price" className="text-slate-800 dark:text-slate-200 text-xs font-semibold">Price (KES)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min={50}
                  value={formData.price}
                  onChange={(event) => onFormDataChange({ ...formData, price: event.target.value })}
                  className="bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-white/20 text-slate-950 dark:text-white h-9 text-sm rounded-lg placeholder:text-slate-400"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="edit-description" className="text-slate-800 dark:text-slate-200 text-xs font-semibold">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(event) => onFormDataChange({ ...formData, description: event.target.value })}
                  className="bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-white/20 text-slate-950 dark:text-white min-h-[60px] text-sm rounded-lg placeholder:text-slate-400"
                  placeholder="Enter product description"
                />
              </div>

              <div>
                <Label htmlFor="edit-aesthetic" className="text-slate-800 dark:text-slate-200 text-xs font-semibold">Category</Label>
                <Select
                  value={formData.aesthetic}
                  onValueChange={(value) => onFormDataChange({ ...formData, aesthetic: value })}
                >
                  <SelectTrigger className="bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-white/20 text-slate-950 dark:text-white h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/20 text-slate-950 dark:text-white z-[110]">
                    {aestheticCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id} className="text-slate-900 dark:text-white focus:bg-yellow-400 focus:text-black">
                        {category.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.product_type === 'physical' && (
                <ProductEditPhysicalOptions formData={formData} onFormDataChange={onFormDataChange} />
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-800 dark:text-slate-200 text-xs font-semibold">Product Photos</Label>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {[formData.imagePreview, ...formData.extraPreviews].filter(Boolean).length} / 3 photos
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Array.from({ length: 3 }).map((_, slot) => {
                    const allPreviews = [formData.imagePreview, ...formData.extraPreviews];
                    const preview = allPreviews[slot];
                    const isFirst = slot === 0;
                    const isDisabled = slot > 0 && !allPreviews[slot - 1];

                    return (
                      <div key={slot} className="relative aspect-square">
                        {preview ? (
                          <>
                            <img
                              src={preview}
                              alt={`Photo ${slot + 1}`}
                              className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-white/10"
                            />
                            {isFirst && (
                              <span className="absolute bottom-1 left-1 text-[8px] font-bold bg-emerald-600 text-white px-1 rounded-sm">Main</span>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemoveImage(slot)}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center shadow-md transition-colors z-10"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </>
                        ) : (
                          <label
                            className={`w-full h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-200 ${isDisabled
                              ? 'border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/[0.02] cursor-not-allowed opacity-40'
                              : 'border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/5 hover:border-emerald-500 hover:bg-slate-100 dark:hover:bg-emerald-400/5 cursor-pointer'
                              }`}
                          >
                            <ImagePlus className={`h-4 w-4 mb-1 ${isDisabled ? 'text-slate-400 dark:text-white/40' : 'text-slate-700 dark:text-white'}`} />
                            <span className={`text-[8px] font-bold ${isDisabled ? 'text-slate-400 dark:text-white/40' : 'text-slate-700 dark:text-white'}`}>
                              {isFirst ? 'Main photo' : `Photo ${slot + 1}`}
                            </span>
                            {!isDisabled && (
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(event) => onImageChange(event, slot)}
                              />
                            )}
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">PNG, JPG up to 5MB.</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-transparent text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 font-semibold"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || isLoading}
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold shadow-md"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


