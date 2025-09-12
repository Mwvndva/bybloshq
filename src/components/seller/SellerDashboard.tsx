import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Settings, 
  DollarSign, 
  RefreshCw,
  CheckCircle,
  Link as LinkIcon,
  Check,
  TrendingUp,
  User,
  ShoppingCart,
  BarChart3,
  Bike,
  LogOut
} from 'lucide-react';
import { sellerApi } from '@/api/sellerApi';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  imageUrl?: string;
  aesthetic: string;
  createdAt: string;
  updatedAt?: string;
  sold?: number;
  status?: 'available' | 'sold';
  isSold?: boolean;
}

interface AnalyticsData {
  totalProducts: number;
  totalRevenue: number;
  monthlySales: Array<{ month: string; sales: number }>;
  totalTicketsSold?: number;
}

interface SellerDashboardProps {
  children?: (props: { 
    fetchData: () => Promise<{
      totalProducts: number;
      totalRevenue: number;
      monthlySales: Array<{ month: string; sales: number }>;
      totalTicketsSold: number;
    }> 
  }) => React.ReactNode;
}

const StatsCard = ({ icon: Icon, title, value, subtitle }: {
  icon: any;
  title: string;
  value: string | number;
  subtitle: string;
}) => (
  <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
    <CardContent className="p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</p>
          <p className="text-4xl font-black text-black">{value}</p>
          <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
        </div>
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Icon className="h-8 w-8 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const SellerDashboard: React.FC<SellerDashboardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sellerProfile, setSellerProfile] = useState<{ fullName: string; shopName: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'products' | 'orders' | 'settings'>('overview');
  
  // Handle seller logout
  const handleLogout = () => {
    // Clear seller token and user data from localStorage
    localStorage.removeItem('sellerToken');
    localStorage.removeItem('seller');
    
    // Redirect to login page
    navigate('/seller/login');
    
    // Show success message
    toast({
      title: 'Logged out successfully',
      description: 'You have been logged out of your seller account.',
    });
  };

  // Fetch data function
  const fetchData = useCallback(async (): Promise<{
    totalProducts: number;
    totalRevenue: number;
    monthlySales: Array<{ month: string; sales: number }>;
    totalTicketsSold: number;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check for seller token first
      const token = localStorage.getItem('sellerToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Fetch products
      const productsData = await sellerApi.getProducts();
      setProducts(productsData);

      // Filter sold products
      const soldProducts = productsData.filter(p => p.isSold || p.status === 'sold');
      const totalSoldProducts = soldProducts.length;
      
      // Calculate analytics
      const totalRevenue = soldProducts.reduce((sum, p) => sum + p.price, 0);
      
      // Create analytics data structure
      const processedAnalytics = {
        totalProducts: productsData.length,
        totalRevenue: totalRevenue,
        monthlySales: [], // We don't have date data for monthly sales
        publishedProducts: productsData.length - totalSoldProducts // Assuming non-sold are published
      };
      
      const result = {
        totalProducts: processedAnalytics.totalProducts,
        totalRevenue: processedAnalytics.totalRevenue,
        monthlySales: processedAnalytics.monthlySales,
        totalTicketsSold: totalSoldProducts || 0
      };
      
      setAnalytics(processedAnalytics);
      return result;
      
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      
      // If unauthorized, clear token and redirect to login
      if (err.response?.status === 401) {
        localStorage.removeItem('sellerToken');
        toast({
          title: 'Session expired',
          description: 'Please log in again to continue',
          variant: 'destructive',
        });
        navigate('/seller/login', { state: { from: location.pathname } });
      } else {
        toast({
          title: 'Error',
          description: err.response?.data?.message || 'Failed to load dashboard data',
          variant: 'destructive',
        });
      }
      
      // Return default values in case of error
      return {
        totalProducts: 0,
        totalRevenue: 0,
        monthlySales: [],
        totalTicketsSold: 0,
      };
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast, location.pathname]);

  // Fetch seller profile
  const fetchSellerProfile = useCallback(async () => {
    try {
      const profile = await sellerApi.getProfile();
      setSellerProfile({
        fullName: profile.fullName || profile.full_name,
        shopName: profile.shopName || profile.shop_name
      });
    } catch (err) {
      console.error('Error fetching seller profile:', err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    fetchSellerProfile();
  }, [fetchData, fetchSellerProfile]);

  // Handle product deletion
  const handleDeleteProduct = async (productId: string) => {
    try {
      await sellerApi.deleteProduct(productId);
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      // Refresh the products list
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    }
  };

  // Create context value to pass to child routes
  const outletContext = {
    products,
    onDeleteProduct: handleDeleteProduct,
    fetchData,
  };

  // If children are provided, render them with the fetchData function
  if (children) {
    return (
      <div className="space-y-6">
        {children({ fetchData })}
      </div>
    );
  }

  // Calculate total sold products
  const totalSold = products.filter(p => p.isSold || p.status === 'sold').length;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center mb-8">
            <Skeleton className="h-32 w-96" />
          </div>
          
          <div className="flex space-x-2 mb-12 bg-white/60 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-gray-200/50 w-fit mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-24 rounded-xl" />
          ))}
        </div>
        
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!analytics || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-3xl flex items-center justify-center shadow-lg">
            <RefreshCw className="h-12 w-12 text-red-600" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-black mb-3">Unable to load dashboard</h3>
            <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
              {error || 'Something went wrong while loading your dashboard data. Please try again.'}
        </p>
        <Button 
          onClick={fetchData}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
        >
              <RefreshCw className="h-5 w-5 mr-2" />
              Try Again
        </Button>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      icon: Package,
      title: 'Total Products',
      value: analytics.totalProducts,
      subtitle: 'Products in your store'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 sm:py-0 sm:h-20 space-y-4 sm:space-y-0">
            {/* Mobile: Stack vertically, Desktop: Horizontal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 w-full sm:w-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-black hover:bg-gray-100/80 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />
              <div className="flex-1 sm:flex-none">
                <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  {sellerProfile?.shopName ? (
                    <span className="block sm:inline">
                      <span className="hidden sm:inline">{sellerProfile.shopName}'s Dashboard</span>
                      <span className="sm:hidden">{sellerProfile.shopName}</span>
                    </span>
                  ) : 'Seller Dashboard'}
          </h1>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                  Welcome back, {sellerProfile?.fullName?.split(' ')[0] || 'Seller'}!
                </p>
              </div>
            </div>
            
            {/* Mobile: Stack buttons vertically, Desktop: Horizontal */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          {sellerProfile?.shopName && (
              <Button
                variant="outline"
                size="sm"
                  className="text-xs h-9 sm:h-10 bg-white border-gray-300 text-black hover:bg-yellow-50 hover:border-yellow-300 flex items-center justify-center gap-2 rounded-xl"
                onClick={async () => {
                  const shopUrl = `${window.location.origin}/shop/${encodeURIComponent(sellerProfile.shopName)}`;
                  try {
                    await navigator.clipboard.writeText(shopUrl);
                    setIsCopied(true);
                    toast({
                      title: 'Link copied!',
                      description: 'Your shop link has been copied to clipboard.',
                    });
                    setTimeout(() => setIsCopied(false), 2000);
                  } catch (err) {
                    toast({
                      title: 'Error',
                      description: 'Failed to copy link. Please try again.',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {isCopied ? (
                  <>
                      <Check className="h-4 w-4" />
                      <span className="hidden sm:inline">Link Copied!</span>
                      <span className="sm:hidden">Copied!</span>
                  </>
                ) : (
                  <>
                      <LinkIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Copy Shop Link</span>
                      <span className="sm:hidden">Copy Link</span>
                  </>
                )}
              </Button>
              )}
              <div className="flex items-center justify-between sm:justify-end space-x-4">
                <a 
                  href="https://wa.me/254748137819"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 px-4 py-2 rounded-xl font-medium transition-colors duration-200 shadow-sm"
                >
                  <Bike className="h-4 w-4" />
                  <span>Delivery</span>
                </a>
                <Button
                  variant="outline"
                  onClick={fetchData}
                  className="flex items-center gap-2 bg-white border-gray-300 text-black hover:bg-yellow-50 hover:border-yellow-300 rounded-xl h-9 sm:h-10 px-3 sm:px-4"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <a 
                  href="https://wa.me/254748137819"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sm:hidden flex items-center justify-center w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl shadow-sm"
                  title="Delivery"
                >
                  <Bike className="h-5 w-5" />
                </a>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="flex justify-center mb-12">
          <div className="w-full max-w-sm">
            {stats.map((stat, index) => (
              <StatsCard key={index} {...stat} />
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-12 bg-white/60 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-gray-200/50 w-full sm:w-fit mx-auto">
          <Button
            variant={activeSection === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('overview')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${
              activeSection === 'overview' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105' 
                : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
            }`}
          >
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Overview</span>
          </Button>
          <Button
            variant={activeSection === 'products' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('products')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${
              activeSection === 'products' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105' 
                : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
            }`}
          >
            <Package className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Products</span>
          </Button>
          <Button
            variant={activeSection === 'orders' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('orders')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${
              activeSection === 'orders' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105' 
                : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
            }`}
          >
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Orders</span>
          </Button>
          <Button
            variant={activeSection === 'settings' ? 'default' : 'ghost'}
            onClick={() => setActiveSection('settings')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base flex-1 sm:flex-none min-w-0 ${
              activeSection === 'settings' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg transform scale-105' 
                : 'text-gray-600 hover:text-black hover:bg-gray-100/80 hover:scale-105'
            }`}
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Settings</span>
          </Button>
      </div>

        {/* Content Sections */}
        {activeSection === 'overview' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-4">Store Overview</h2>
              <p className="text-gray-600 text-lg font-medium max-w-2xl mx-auto">Manage your products and track your store performance</p>
      </div>

      {/* Recent Products */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
            <div>
                  <h3 className="text-3xl font-black text-black">Recent Products</h3>
                  <p className="text-gray-600 font-medium mt-2">Your most recently added products</p>
            </div>
            <Button 
              size="sm" 
              onClick={() => navigate('/seller/add-product')}
                  className="gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
              
          {products.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {products.slice(0, 6).map((product) => (
                    <Card key={product.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
                      <div className="relative overflow-hidden rounded-t-2xl">
                        <img
                          src={product.image_url || product.imageUrl || '/placeholder-image.jpg'}
                        alt={product.name}
                          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Badge 
                          variant={product.status === 'sold' || product.isSold ? 'destructive' : 'secondary'}
                          className="absolute top-4 left-4 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-3 py-1 text-xs font-bold rounded-xl"
                    >
                      {product.status === 'sold' || product.isSold ? 'Sold' : 'Available'}
                    </Badge>
                  </div>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-black mb-2 line-clamp-1 text-lg">{product.name}</h3>
                        <p className="text-yellow-600 font-black text-xl mb-3">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                            {product.aesthetic}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                    <Package className="h-12 w-12 text-yellow-600" />
            </div>
                  <h3 className="text-2xl font-black text-black mb-3">No products found</h3>
                  <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">Add your first product to get started with your store</p>
              <Button 
                onClick={() => navigate('/seller/add-product')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
              >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Your First Product
              </Button>
            </div>
          )}
            </div>

                  {/* Store Performance */}
            <div className="flex justify-center">
              <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl max-w-md w-full">
                <CardHeader>
                  <CardTitle className="text-2xl font-black text-black flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    Store Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Active Products</p>
                      <p className="text-2xl font-black text-black">{analytics.totalProducts - totalSold}</p>
                    </div>
                    <Package className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Products Sold</p>
                      <p className="text-2xl font-black text-black">{totalSold}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
        </CardContent>
      </Card>
            </div>
          </div>
        )}

        {activeSection === 'products' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-4">Product Management</h2>
              <p className="text-gray-600 text-lg font-medium">Manage all your products in one place</p>
            </div>

      {/* Quick Actions */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-3xl font-black text-black">Quick Actions</h3>
                  <p className="text-gray-600 font-medium mt-2">Common tasks for your products</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/seller/add-product')}
                  className="gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </div>
              
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Button 
              variant="outline" 
                  className="h-14 sm:h-16 justify-start gap-3 sm:gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
              onClick={() => navigate('/seller/products')}
            >
                  <Package className="h-6 w-6" />
                  <div>
                    <p className="font-semibold">View All Products</p>
                    <p className="text-sm text-gray-500">See all your products</p>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-16 justify-start gap-4 text-left border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 rounded-xl"
                  onClick={() => navigate('/seller/add-product')}
                >
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                  <div>
                    <p className="font-semibold">Add New Product</p>
                    <p className="text-sm text-gray-500">Create a new listing</p>
                  </div>
                </Button>
                
              </div>
            </div>

            {/* Recent Products */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-3xl font-black text-black">Recent Products</h3>
                  <p className="text-gray-600 font-medium mt-2">Your most recently added products</p>
                </div>
              </div>
              
              {products.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {products.slice(0, 6).map((product) => (
                    <Card key={product.id} className="group hover:shadow-2xl transition-all duration-500 border-0 bg-white/80 backdrop-blur-sm transform hover:-translate-y-2">
                      <div className="relative overflow-hidden rounded-t-2xl">
                        <img
                          src={product.image_url || product.imageUrl || '/placeholder-image.jpg'}
                          alt={product.name}
                          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <Badge 
                          variant={product.status === 'sold' || product.isSold ? 'destructive' : 'secondary'}
                          className="absolute top-4 left-4 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-3 py-1 text-xs font-bold rounded-xl"
                        >
                          {product.status === 'sold' || product.isSold ? 'Sold' : 'Available'}
                        </Badge>
                      </div>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-black mb-2 line-clamp-1 text-lg">{product.name}</h3>
                        <p className="text-yellow-600 font-black text-xl mb-3">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                            {product.aesthetic}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                    <Package className="h-12 w-12 text-yellow-600" />
                  </div>
                  <h3 className="text-2xl font-black text-black mb-3">No products found</h3>
                  <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">Add your first product to get started with your store</p>
                  <Button 
                    onClick={() => navigate('/seller/add-product')}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-8 py-3 rounded-xl font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Your First Product
            </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-4">Order Management</h2>
              <p className="text-gray-600 text-lg font-medium">Coming soon - Manage your customer orders</p>
            </div>
            
            {/* Coming Soon Card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center shadow-lg">
                  <ShoppingCart className="h-12 w-12 text-yellow-600" />
                </div>
                <h3 className="text-2xl font-black text-black mb-3">Coming Soon</h3>
                <p className="text-gray-600 text-lg font-medium max-w-md mx-auto mb-6">
                  We're working hard to bring you a comprehensive order management system. 
                  You'll soon be able to view, track, and manage all your customer orders in one place.
                </p>
                <div className="flex justify-center space-x-4">
            <Button 
              variant="outline" 
                    className="border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl px-6 py-3"
                    onClick={() => setActiveSection('products')}
                  >
                    Manage Products
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg px-6 py-3 rounded-xl font-semibold"
                    onClick={() => setActiveSection('overview')}
                  >
                    Back to Dashboard
            </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-4">Store Settings</h2>
              <p className="text-gray-600 text-lg font-medium">Manage your store configuration and preferences</p>
            </div>
            
{/* Store Information */}
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-3xl font-black text-black">Store Information</h3>
                  <p className="text-gray-600 font-medium mt-2">Your current store details</p>
                </div>
                <Button 
                  variant="destructive"
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700">Store Name</p>
                    <p className="text-lg font-bold text-black">{sellerProfile?.shopName || 'Not set'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700">Owner Name</p>
                    <p className="text-lg font-bold text-black">{sellerProfile?.fullName || 'Not set'}</p>
                  </div>
                    </div>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700">Total Products</p>
                    <p className="text-lg font-bold text-black">{analytics?.totalProducts || 0}</p>
                    </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700">Active Products</p>
                    <p className="text-lg font-bold text-black">{(analytics?.totalProducts || 0) - totalSold}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;