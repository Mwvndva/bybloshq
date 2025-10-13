
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Package, PlusCircle } from 'lucide-react';
import Header from '@/components/Header';
import SellerRegistration from '@/components/seller/SellerRegistration';
import ProductUpload from '@/components/seller/ProductUpload';
import SellerDashboard from '@/components/seller/SellerDashboard';

type SellerView = 'register' | 'dashboard' | 'upload';

const Seller = () => {
  const [currentView, setCurrentView] = useState<SellerView>('register');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleRegistrationSuccess = () => {
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  const renderContent = () => {
    if (!isLoggedIn && currentView === 'register') {
      return <SellerRegistration onSuccess={handleRegistrationSuccess} />;
    }

    if (isLoggedIn) {
      switch (currentView) {
        case 'dashboard':
          return <SellerDashboard />;
        case 'upload':
          return <ProductUpload onSuccess={() => setCurrentView('dashboard')} />;
        default:
          return <SellerDashboard />;
      }
    }

    return <SellerRegistration onSuccess={handleRegistrationSuccess} />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ivory via-ivory-cream to-floral-rose/5">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-noir mb-4">
            Seller Portal
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join our curated marketplace and share your aesthetic vision with the world
          </p>
        </div>

        {/* Navigation for logged-in sellers */}
        {isLoggedIn && (
          <div className="flex justify-center mb-8">
            <div className="flex space-x-4 bg-white rounded-lg p-2 shadow-sm">
              <Button
                variant={currentView === 'dashboard' ? 'default' : 'ghost'}
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center space-x-2"
              >
                <Package className="w-4 h-4" />
                <span>Dashboard</span>
              </Button>
              <Button
                variant={currentView === 'upload' ? 'default' : 'ghost'}
                onClick={() => setCurrentView('upload')}
                className="flex items-center space-x-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Upload Product</span>
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Seller;
