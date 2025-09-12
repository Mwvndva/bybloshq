import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Phone, User, ArrowLeft, Store, Package, Heart } from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';
import { formatCurrency } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';
import type { Product as ProductType } from '@/types';
import type { Product as SellerApiProduct } from '@/api/sellerApi';

interface SellerInfo {
  id?: string | number;
  fullName?: string;
  shopName?: string;
  phone?: string;
  email?: string;
}

const ShopPage = () => {
  const { shopName } = useParams<{ shopName: string }>();
  const [products, setProducts] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);

  useEffect(() => {
    const fetchShopData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (!shopName) {
          throw new Error('Shop name is required');
        }
        
        console.log('Fetching seller with shop name:', shopName);
        // First, get the seller by shop name
        const seller = await sellerApi.getSellerByShopName(shopName);
        
        if (!seller) {
          throw new Error('Shop not found');
        }
        
        console.log('Found seller:', seller);
        setSellerInfo({
          id: seller.id,
          fullName: seller.fullName || seller.full_name,
          shopName: seller.shopName || seller.shop_name,
          phone: seller.phone,
          email: seller.email
        });

        // Then fetch products for this seller
        console.log('Fetching products for seller:', seller.id);
        const sellerProducts = await sellerApi.getProducts();
        console.log('Fetched products:', sellerProducts);
        
        // Map seller API products to our ProductType and filter available ones
        const availableProducts = (sellerProducts as SellerApiProduct[])
          .map(p => ({
            ...p,
            sellerId: p.sellerId || '',
            isSold: p.isSold || false,
            status: p.status || 'available',
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
            aesthetic: (p as any).aesthetic || 'all'
          } as ProductType))
          .filter(p => !p.isSold && p.status !== 'sold');
        
        setProducts(availableProducts);
      } catch (err: any) {
        console.error('Error fetching shop data:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load shop data');
      } finally {
        setIsLoading(false);
      }
    };

    if (shopName) {
      fetchShopData();
    } else {
      setError('Shop name is required');
      setIsLoading(false);
    }
  }, [shopName]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-black mb-3">Loading Shop</h3>
            <p className="text-gray-600 text-lg font-medium">Please wait while we fetch the shop details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Store className="h-12 w-12 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-black mb-3">Error Loading Shop</h2>
            <p className="text-gray-600 text-lg font-medium mb-6">{error}</p>
            <Button 
              asChild
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
            >
              <Link to="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="bg-white/60 backdrop-blur-sm border-b border-gray-200/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                asChild
                className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-4 py-2"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
              <div>
                <h1 className="text-4xl font-black text-black mb-2">{sellerInfo?.shopName || 'Shop'}</h1>
                {sellerInfo?.fullName && (
                  <p className="text-gray-600 text-lg font-medium">By {sellerInfo.fullName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-4 py-2 rounded-xl font-bold text-sm">
                {products.length} {products.length === 1 ? 'Product' : 'Products'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Products */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {products.length > 0 ? (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black text-black">Available Products</h2>
                <p className="text-gray-600 font-medium mt-2">
                  Browse through {products.length} {products.length === 1 ? 'item' : 'items'} from this shop
                </p>
              </div>
              <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-4 py-2 rounded-xl font-bold text-sm">
                {products.length} Items
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard 
                  key={product.id}
                  product={{
                    ...product,
                    seller: sellerInfo ? {
                      id: sellerInfo.id?.toString() || '',
                      fullName: sellerInfo.fullName || '',
                      phone: sellerInfo.phone || '',
                      email: sellerInfo.email || '',
                      shopName: sellerInfo.shopName || '',
                      // Add required fields from Seller type
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      // Add optional fields
                      bio: '',
                      avatarUrl: '',
                      location: '',
                      website: '',
                      socialMedia: {}
                    } : undefined
                  } as ProductType}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-12 shadow-lg border border-gray-200/50 text-center">
            <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
              <Package className="h-12 w-12 text-yellow-600" />
            </div>
            <h3 className="text-2xl font-black text-black mb-3">No Products Available</h3>
            <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
              This shop doesn't have any products listed yet. Check back later for new items!
            </p>
            <Button 
              asChild
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
            >
              <Link to="/">Browse Other Shops</Link>
            </Button>
          </div>
        )}

        {/* Product Details Dialog */}
        <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
          <DialogContent className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl rounded-3xl">
            {selectedProduct && (
              <>
                <DialogHeader className="text-center pb-6">
                  <DialogTitle className="text-2xl font-black text-black">Product Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-black mb-2">{selectedProduct.name}</h3>
                    <p className="text-gray-600 mb-4 leading-relaxed">{selectedProduct.description}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-black text-yellow-600">{formatCurrency(selectedProduct.price)}</p>
                      <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-3 py-1 rounded-xl text-sm font-bold">
                        Available
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6">
                    <h4 className="font-bold text-black mb-4 flex items-center gap-2">
                      <Store className="h-5 w-5 text-yellow-600" />
                      Seller Information
                    </h4>
                    {sellerInfo && (
                      <div className="space-y-3">
                        <div className="flex items-center text-sm bg-white/60 rounded-xl p-3">
                          <User className="h-4 w-4 mr-3 text-gray-500" />
                          <span className="font-medium">{sellerInfo.fullName || 'N/A'}</span>
                        </div>
                        {sellerInfo.phone && (
                          <div className="flex items-center text-sm bg-white/60 rounded-xl p-3">
                            <Phone className="h-4 w-4 mr-3 text-gray-500" />
                            <a href={`tel:${sellerInfo.phone}`} className="hover:underline font-medium">
                              {sellerInfo.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ShopPage;
