import SellerSettings from '@/components/seller/SellerSettings';
import { SellerLayout } from '@/components/layout/SellerLayout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seller Settings',
  description: 'Manage your seller account settings and preferences.',
};

export default function SellerSettingsPage() {
  return (
    <SellerLayout>
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Account Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your seller account information and preferences
          </p>
        </div>
        <SellerSettings />
      </div>
    </SellerLayout>
  );
}
