import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProductsList } from '@/components/seller/ProductsList';
import { sellerApi } from '@/api/sellerApi';
import { toast } from '@/components/ui/sonner';
import { SellerLayout } from '@/components/layout/SellerLayout';

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
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await sellerApi.deleteProduct(id);
        toast.success('Product deleted successfully');
        fetchProducts();
      } catch (error) {
        console.error('Failed to delete product:', error);
        toast.error('Failed to delete product');
      }
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
    <SellerLayout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Products</h1>
            <p className="text-muted-foreground">Manage your product listings</p>
          </div>
          <Button onClick={() => navigate('/seller/products/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : products.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Your Products</h2>
                  <Button onClick={fetchProducts} variant="outline" size="sm">
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
              <div className="text-center py-8 text-muted-foreground">
                <p>No products found. Add your first product to get started.</p>
                <Button variant="link" onClick={() => navigate('/seller/products/new')}>
                  Add Product
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
