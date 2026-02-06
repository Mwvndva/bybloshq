import React, { useState, useEffect } from 'react';
import { RouteObject, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { SellerProtectedRoute } from '@/components/auth/AppProtectedRoute';
import { SellerLayout } from '../layouts/SellerLayout';
import SellerDashboard from '../components/seller/SellerDashboard';
import SellerRegistration from '../components/seller/SellerRegistration';
import ShopSetup from '../components/seller/ShopSetup';
import { SellerLogin } from '../components/seller/SellerLogin';
import { ProductsList } from '../components/seller/ProductsList';
import AddProductForm from '../components/seller/AddProductForm';
import { Button } from '@/components/ui/button';
import { useToast } from '../hooks/use-toast';
import { sellerApi } from '../api/sellerApi';
import { Plus, Pencil, Trash2, EyeOff, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '../lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Products route component that will be rendered within the dashboard
function ProductsListWrapper() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<{
    productId: string | null;
    isOpen: boolean;
    isSold: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await sellerApi.getProducts();
        setProducts(response);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast({
          title: 'Error loading products',
          description: 'Failed to load products. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // toast is stable, no need to track it

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      setIsDeleting(true);
      await sellerApi.deleteProduct(productToDelete);

      // Refresh the products list
      const response = await sellerApi.getProducts();
      setProducts(response);

      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });

      setShowDeleteDialog(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };


  const handleAddProduct = () => {
    navigate('/seller/add-product');
  };

  const handleStatusUpdate = async (productId: string, isSold: boolean) => {
    try {
      // Start with optimistic update
      setProducts(products.map(product =>
        product.id === productId ? {
          ...product,
          status: isSold ? 'sold' : 'available',
          isSold,
          soldAt: isSold ? new Date().toISOString() : null
        } : product
      ));

      // Update the server
      await sellerApi.updateProduct(productId, {
        status: isSold ? 'sold' : 'available',
        isSold,
        soldAt: isSold ? new Date().toISOString() : null
      });

      toast({
        title: 'Success',
        description: isSold ? 'Product marked as sold' : 'Product marked as available',
      });
      setStatusUpdate(null);
    } catch (error) {
      // If there's an error, revert the local state
      setProducts(products.map(product =>
        product.id === productId ? {
          ...product,
          status: isSold ? 'available' : 'sold',
          isSold: !isSold,
          soldAt: isSold ? null : product.soldAt
        } : product
      ));

      console.error('Failed to update product status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update product status. Changes have been reverted.',
        variant: 'destructive',
      });
      setStatusUpdate(null);
    }
  };

  const handleOpenStatusDialog = (productId: string, isSold: boolean) => {
    setStatusUpdate({ productId, isOpen: true, isSold });
  };

  const handleCloseStatusDialog = () => {
    setStatusUpdate(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
            <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-black mb-3">Loading Products</h3>
            <p className="text-gray-600 text-lg font-medium">Please wait while we fetch your products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-black mb-4">Product Management</h1>
          <p className="text-gray-600 text-lg font-medium">Manage all your products in one place</p>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50 mb-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-black text-black">Quick Actions</h3>
              <p className="text-gray-600 font-medium mt-2">Common tasks for your products</p>
            </div>
            <Button
              size="sm"
              onClick={handleAddProduct}
              className="gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Button
              variant="outline"
              className="h-16 justify-start gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-6 w-6" />
              <div>
                <p className="font-semibold">Refresh Products</p>
                <p className="text-sm text-gray-300">Reload all products</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-16 justify-start gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
              onClick={handleAddProduct}
            >
              <Plus className="h-6 w-6" />
              <div>
                <p className="font-semibold">Add New Product</p>
                <p className="text-sm text-gray-300">Create a new listing</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-16 justify-start gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
              onClick={() => navigate('/seller/dashboard')}
            >
              <CheckCircle className="h-6 w-6" />
              <div>
                <p className="font-semibold">Back to Dashboard</p>
                <p className="text-sm text-gray-300">Return to overview</p>
              </div>
            </Button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-3xl font-black text-black">Your Products</h3>
              <p className="text-gray-600 font-medium mt-2">
                {products.length} {products.length === 1 ? 'product' : 'products'} total
              </p>
            </div>
            <Badge variant="secondary" className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-4 py-2 text-sm font-bold rounded-xl">
              {products.filter(p => p.status === 'available' || !p.isSold).length} Active
            </Badge>
          </div>

          {products.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Card key={product.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
                  <div className="relative overflow-hidden rounded-t-2xl">
                    <img
                      src={product.image_url || product.imageUrl || '/placeholder-image.jpg'}
                      alt={product.name}
                      className="w-full h-32 sm:h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Badge
                      variant={product.status === 'sold' || product.isSold ? 'destructive' : 'secondary'}
                      className="absolute top-4 left-4 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-3 py-1 text-xs font-bold rounded-xl"
                    >
                      {product.status === 'sold' || product.isSold ? 'Sold' : 'Available'}
                    </Badge>
                    <div className="absolute top-4 right-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white/90 hover:bg-white rounded-xl shadow-lg backdrop-blur-sm"
                        onClick={() => handleDeleteClick(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-black mb-2 line-clamp-1 text-lg">{product.name}</h3>
                    <p className="text-yellow-600 font-black text-xl mb-3">
                      {formatCurrency(product.price)}
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-4">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                        {product.aesthetic}
                      </Badge>
                      <span className="text-xs text-gray-300">
                        {new Date(product.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-4 flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl"
                        onClick={() => handleOpenStatusDialog(product.id, !product.isSold)}
                      >
                        {product.isSold ? 'Mark Available' : 'Mark Sold'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                <Plus className="h-12 w-12 text-yellow-600" />
              </div>
              <h3 className="text-2xl font-black text-black mb-3">No products found</h3>
              <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">Add your first product to get started with your store</p>
              <Button
                onClick={handleAddProduct}
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Product
              </Button>
            </div>
          )}
        </div>

        {statusUpdate && (
          <AlertDialog open={statusUpdate.isOpen} onOpenChange={handleCloseStatusDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {statusUpdate.isSold ? 'Mark as Sold' : 'Mark as Available'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to {statusUpdate.isSold ? 'mark this product as sold' : 'mark this product as available'}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusUpdate(statusUpdate.productId!, statusUpdate.isSold)}
                >
                  {statusUpdate.isSold ? 'Mark as Sold' : 'Mark as Available'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Delete Product Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-white" />
                </div>
                Delete Product
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 leading-relaxed">
                Are you sure you want to delete this product? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-red-800 font-semibold">
                ⚠️ This action cannot be undone. The product will be permanently removed from your store.
              </p>
            </div>

            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel
                onClick={() => {
                  setShowDeleteDialog(false);
                  setProductToDelete(null);
                }}
                disabled={isDeleting}
                className="border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Product'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Create the seller routes
export const sellerRoutes: RouteObject[] = [
  // Public auth routes (no layout)
  {
    path: '/seller/reset-password',
    element: <ResetPasswordPage />,
  },

  // Main seller routes with layout
  {
    path: '/seller',
    element: <SellerLayout />,
    children: [
      // Public routes (login, register) - no protection needed
      {
        path: 'register',
        element: <SellerRegistration />,
      },
      {
        path: 'login',
        element: <SellerLogin />,
      },

      // Protected routes - require authentication
      {
        element: (
          <SellerProtectedRoute>
            <Outlet />
          </SellerProtectedRoute>
        ),
        children: [
          {
            path: 'dashboard',
            element: <SellerDashboard />,
            children: [
              {
                index: true,
                element: (
                  <div className="p-6">
                    <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {/* Overview content will be rendered by SellerDashboard */}
                    </div>
                  </div>
                ),
              },
            ],
          },
          {
            path: 'products',
            element: <ProductsListWrapper />,
          },
          {
            path: 'shop-setup',
            element: <ShopSetup />,
          },
          {
            path: 'add-product',
            element: <AddProductForm onSuccess={() => { }} />,
          },
          // Redirects for protected routes
          {
            path: '',
            element: <Navigate to="dashboard" replace />,
          },
          {
            path: '*',
            element: <Navigate to="dashboard" replace />,
          },
        ],
      },

      // Redirects for non-protected routes
      {
        path: '',
        element: <Navigate to="login" replace />,
      },
      {
        path: '*',
        element: <Navigate to="login" replace />,
      },
    ],
  },
];
