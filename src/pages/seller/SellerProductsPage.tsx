import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProductsList } from '@/components/seller/ProductsList';
import { sellerApi } from '@/api/sellerApi';
import { toast } from '@/components/ui/sonner';

export default function SellerProductsPage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  // Toast is imported directly from sonner

  const fetchProducts = async () => {
    try {
      // Get the seller ID from localStorage
      const sellerData = localStorage.getItem('seller');
      if (!sellerData) {
        throw new Error('Seller not authenticated');
      }
      // No need to pass seller ID as it's handled by the auth token
      const data = await sellerApi.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch products on component mount and when the component is focused
  useEffect(() => {
    const handleFocus = () => {
      fetchProducts();
    };

    // Add event listener for when the window regains focus
    window.addEventListener('focus', handleFocus);

    // Initial fetch
    fetchProducts();

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleDelete = async (id: string) => {
    // Store product to delete for potential revert
    const productToDelete = products.find(p => p.id === id);

    try {
      // Optimistic update - remove from UI immediately
      setProducts(prevProducts => prevProducts.filter(p => p.id !== id));

      await sellerApi.deleteProduct(id);
      toast.success('Product deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete product:', error);

      // Revert optimistic update on error
      if (productToDelete) {
        setProducts(prevProducts => [...prevProducts, productToDelete]);
      }

      // Show specific error message
      const errorMessage = error?.response?.data?.message ||
        error?.message ||
        'Failed to delete product. Please try again.';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/seller/products/edit/${id}`);
  };

  const handleStatusUpdate = async (productId: string, status: 'available' | 'sold', soldAt: string | null) => {
    // Get the current product data
    const product = products.find(p => p.id === productId);
    if (!product) {
      console.error('Product not found:', productId);
      return;
    }

    const productName = product.name || 'Product';
    const isSold = status === 'sold';
    const newSoldAt = isSold ? (soldAt || new Date().toISOString()) : null;

    // Create a completely new products array to ensure React detects the change
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            status,
            isSold,
            soldAt: newSoldAt,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });
    });

    try {
      // Update the backend
      await sellerApi.updateProduct(productId, {
        status,
        soldAt: newSoldAt
      });

      // Show success message
      toast.success(`${productName} has been marked as ${status}`);

      // Force a refresh of the products list to ensure consistency
      fetchProducts();

    } catch (error) {
      console.error('Failed to update product status:', error);

      // Revert the optimistic update on error
      setProducts(prevProducts =>
        prevProducts.map(p => p.id === productId ? product : p)
      );

      toast.error(`Failed to update ${productName}. Please try again.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Products</h1>
            <p className="text-zinc-400">Manage your product listings</p>
          </div>
          <Button 
            onClick={() => navigate('/seller/products/new')}
            className="bg-emerald-500 text-black font-bold rounded-full hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] px-6 py-3 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        <div className="bg-zinc-900/30 backdrop-blur-xl border border-white/5 rounded-2xl">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-semibold text-white">Product List</h2>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : products.length > 0 ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Your Products</h2>
                  <Button 
                    onClick={fetchProducts} 
                    variant="outline" 
                    size="sm"
                    className="border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <ProductsList
                  products={products}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onStatusUpdate={handleStatusUpdate}
                  onRefresh={fetchProducts}
                />
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Plus className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No products yet</h3>
                <p className="text-zinc-400 mb-6">Add your first product to get started</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/seller/products/new')}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  Add Product
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
