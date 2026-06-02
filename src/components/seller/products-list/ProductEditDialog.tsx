import type { ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { aestheticCategories } from '../../AestheticCategories';

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
      <DialogContent className="bg-[#000000] border border-white/10 text-white w-[95vw] max-w-md max-h-[85dvh] overflow-y-auto p-3 sm:p-4 rounded-xl">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0 text-left mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 -ml-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold text-white">Edit Product</DialogTitle>
            <DialogDescription className="text-white text-[10px] sm:text-xs">
              Update product information
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-name" className="text-white text-xs">Product Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(event) => onFormDataChange({ ...formData, name: event.target.value })}
                  className="bg-black border-white/20 text-white h-9 text-sm"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <Label htmlFor="edit-price" className="text-white text-xs">Price (KES)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min={50}
                  value={formData.price}
                  onChange={(event) => onFormDataChange({ ...formData, price: event.target.value })}
                  className="bg-black border-white/20 text-white h-9 text-sm"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="edit-description" className="text-white text-xs">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(event) => onFormDataChange({ ...formData, description: event.target.value })}
                  className="bg-black border-white/20 text-white min-h-[60px] text-sm"
                  placeholder="Enter product description"
                />
              </div>

              <div>
                <Label htmlFor="edit-aesthetic" className="text-white text-xs">Category</Label>
                <Select
                  value={formData.aesthetic}
                  onValueChange={(value) => onFormDataChange({ ...formData, aesthetic: value })}
                >
                  <SelectTrigger className="bg-black border-white/20 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/20">
                    {aestheticCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id} className="text-white hover:bg-white/5">
                        {category.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.product_type === 'physical' && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                  <label className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-white text-xs font-semibold">Custom product</span>
                      <span className="block text-[10px] text-white/60">Require buyer instructions and show production time.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={formData.is_custom_product}
                      onChange={(event) => onFormDataChange({ ...formData, is_custom_product: event.target.checked, is_imported_product: event.target.checked ? false : formData.is_imported_product })}
                      className="h-4 w-4 accent-yellow-400"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <span>
                      <span className="block text-white text-xs font-semibold">Imported / pre-order item</span>
                      <span className="block text-[10px] text-white/60">Show buyers when the item is expected to be ready.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={formData.is_imported_product}
                      onChange={(event) => onFormDataChange({ ...formData, is_imported_product: event.target.checked, is_custom_product: event.target.checked ? false : formData.is_custom_product })}
                      className="h-4 w-4 accent-yellow-400"
                    />
                  </label>

                  {formData.is_custom_product && (
                    <>
                      <div>
                        <Label className="text-white text-xs">Production days</Label>
                        <Select
                          value={formData.production_days}
                          onValueChange={(value) => onFormDataChange({ ...formData, production_days: value })}
                        >
                          <SelectTrigger className="bg-black border-white/20 text-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black border-white/20">
                            {[1, 2, 3, 4, 5].map(day => (
                              <SelectItem key={day} value={String(day)} className="text-white hover:bg-white/5">
                                {day} {day === 1 ? 'day' : 'days'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-white text-xs">Buyer instruction prompt</Label>
                        <Textarea
                          value={formData.customization_prompt}
                          onChange={(event) => onFormDataChange({ ...formData, customization_prompt: event.target.value })}
                          className="bg-black border-white/20 text-white min-h-[60px] text-sm"
                          placeholder="Tell the seller exactly what you want customized."
                        />
                      </div>
                    </>
                  )}

                  {formData.is_imported_product && (
                    <div>
                      <Label className="text-white text-xs">Estimated ready time</Label>
                      <Select
                        value={formData.import_days}
                        onValueChange={(value) => onFormDataChange({ ...formData, import_days: value })}
                      >
                        <SelectTrigger className="bg-black border-white/20 text-white h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/20">
                          {[7, 14, 21, 30].map(day => (
                            <SelectItem key={day} value={String(day)} className="text-white hover:bg-white/5">
                              {day} days
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-800">
                        Buyers will see: Imported item, ready in up to {formData.import_days} days. Delivery starts after seller handoff.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-white text-xs">Product Photos</Label>
                  <span className="text-[10px] text-white">
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
                              className="w-full h-full object-cover rounded-lg border border-white/10"
                            />
                            {isFirst && (
                              <span className="absolute bottom-1 left-1 text-[8px] font-bold bg-emerald-500/90 text-white px-1 rounded-sm">Main</span>
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
                              ? 'border-white/5 bg-white/[0.02] cursor-not-allowed opacity-40'
                              : 'border-white/20 bg-white/5 hover:border-emerald-400/40 hover:bg-emerald-400/5 cursor-pointer'
                              }`}
                          >
                            <ImagePlus className={`h-4 w-4 mb-1 ${isDisabled ? 'text-white/40' : 'text-white'}`} />
                            <span className={`text-[8px] font-medium ${isDisabled ? 'text-white/40' : 'text-white'}`}>
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
                <p className="text-[10px] text-white mt-2">PNG, JPG up to 5MB.</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="border border-white/20 text-white hover:bg-white/10"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || isLoading}
            className="bg-white/10 hover:bg-white/15 text-white border border-white/15 font-semibold"
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
