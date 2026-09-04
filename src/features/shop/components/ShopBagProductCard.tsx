import { toast } from 'sonner';
import type { Product } from '@/shared/types';
import { getProductFlags, type ProductWithApiFields } from '@/features/shop/utils/productCardUtils';
import { useBag } from '../bag/BagContext';
import { ShopProductCard } from './ShopProductCard';

/**
 * Shop-page wrapper that connects the minimal product card to the bag: tapping
 * adds the product (spec §19), and an in-bag product shows the remove (x) control.
 * Services are added to the bag too, then booked in the bag checkout.
 */
export function ShopBagProductCard({ product, isReadOnly = false }: { product: Product; isReadOnly?: boolean }) {
  const bag = useBag();
  const { isSold } = getProductFlags(product as unknown as ProductWithApiFields);
  const inBag = !isReadOnly && bag.hasProduct(product.id);

  const handleTap = () => {
    if (isReadOnly) {
      toast.info('Creator Preview: Purchases and cart additions are disabled while inspecting this shop.');
      return;
    }
    if (isSold) {
      toast.error('This product is sold.');
      return;
    }
    const result = bag.addProduct(product);
    if (!result.ok) {
      toast.error(result.reason || 'Your bag is full.');
      return;
    }
    toast.success(`${product.name} added to bag`);
  };

  return (
    <ShopProductCard
      product={product}
      onTap={handleTap}
      inBag={inBag}
      isReadOnly={isReadOnly}
      onRemoveFromBag={isReadOnly ? undefined : () => bag.removeProduct(product.id)}
    />
  );
}

export default ShopBagProductCard;
