import SellerSettings from '@/components/seller/SellerSettings';
import { SellerLayout } from '@/components/layout/SellerLayout';

export default function SellerSettingsPage() {
  return (
    <SellerLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Seller Settings</h1>
        <SellerSettings />
      </div>
    </SellerLayout>
  );
}
