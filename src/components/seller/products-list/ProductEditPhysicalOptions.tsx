import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ProductEditFormData } from './ProductEditDialog';

interface ProductEditPhysicalOptionsProps {
  formData: ProductEditFormData;
  onFormDataChange: (data: ProductEditFormData) => void;
}

export function ProductEditPhysicalOptions({ formData, onFormDataChange }: ProductEditPhysicalOptionsProps) {
  return (
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
  );
}
