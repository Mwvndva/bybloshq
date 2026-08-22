import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import type { ProductEditFormData } from './ProductEditDialog';

interface ProductEditPhysicalOptionsProps {
  formData: ProductEditFormData;
  onFormDataChange: (data: ProductEditFormData) => void;
}

export function ProductEditPhysicalOptions({ formData, onFormDataChange }: ProductEditPhysicalOptionsProps) {
  return (
                <div className="rounded-xl seller-card-soft p-3 space-y-3">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span>
                      <span className="block text-white text-xs font-semibold">Custom product</span>
                      <span className="block text-[10px] text-white/60 font-medium">Require buyer instructions and show production time.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={formData.is_custom_product}
                      onChange={(event) => onFormDataChange({ ...formData, is_custom_product: event.target.checked, is_imported_product: event.target.checked ? false : formData.is_imported_product })}
                      className="h-4 w-4 accent-yellow-400"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 cursor-pointer">
                    <span>
                      <span className="block text-white text-xs font-semibold">Imported / pre-order item</span>
                      <span className="block text-[10px] text-white/60 font-medium">Show buyers when the item is expected to be ready.</span>
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
                        <Label className="seller-label font-semibold">Production days</Label>
                        <Select
                          value={formData.production_days}
                          onValueChange={(value) => onFormDataChange({ ...formData, production_days: value })}
                        >
                          <SelectTrigger className="seller-field h-9 rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-white/10 text-white z-[110]">
                            {[1, 2, 3, 4, 5].map(day => (
                              <SelectItem key={day} value={String(day)} className="text-white focus:bg-[var(--theme-button-bg,#f5c518)] focus:text-[var(--theme-button-text,#000000)]">
                                {day} {day === 1 ? 'day' : 'days'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="seller-label font-semibold">Buyer instruction prompt</Label>
                        <Textarea
                          value={formData.customization_prompt}
                          onChange={(event) => onFormDataChange({ ...formData, customization_prompt: event.target.value })}
                          className="seller-field min-h-[60px] text-sm rounded-lg"
                          placeholder="Tell the seller exactly what you want customized."
                        />
                      </div>
                    </>
                  )}

                  {formData.is_imported_product && (
                    <div>
                      <Label className="seller-label font-semibold">Estimated ready time</Label>
                      <Select
                        value={formData.import_days}
                        onValueChange={(value) => onFormDataChange({ ...formData, import_days: value })}
                      >
                        <SelectTrigger className="seller-field h-9 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a0a] border-white/10 text-white z-[110]">
                          {[7, 14, 21, 30].map(day => (
                            <SelectItem key={day} value={String(day)} className="text-white focus:bg-[var(--theme-button-bg,#f5c518)] focus:text-[var(--theme-button-text,#000000)]">
                              {day} days
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-300">
                        Buyers will see: Imported item, ready in up to {formData.import_days} days. Delivery starts after seller handoff.
                      </p>
                    </div>
                  )}
                </div>
  );
}
