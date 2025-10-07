
import { useEffect, useState, useCallback } from 'react';
import { ProductCard } from './ProductCard';
import { Aesthetic, Seller } from '@/types';
import { publicApiService } from '@/api/publicApi';
import { AestheticWithNone, ProductGridProps } from '@/types/components';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  sellerId: string;
  seller?: Seller;
  isSold: boolean;
  status: 'available' | 'sold';
  soldAt?: string | null;
  createdAt: string;
  updatedAt: string;
  aesthetic: Aesthetic;
}

const ProductGrid = ({ selectedAesthetic, searchQuery = '', locationCity, locationArea, priceMin, priceMax }: ProductGridProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  interface SellerInfo {
    name: string;
    phone?: string;
  }
  
  const [sellers, setSellers] = useState<Record<string, Seller>>({});
  
  // Transform product data to ensure it matches our Product interface
  const transformProduct = (product: any): Product => {
    if (!product.image_url && !product.imageUrl) {
      console.error('Product is missing required image URL:', product);
      throw new Error('Product is missing required image');
    }
    
    const transformedProduct: any = {
      id: String(product.id || ''),
      name: String(product.name || 'Unnamed Product'),
      description: String(product.description || ''),
      price: Number(product.price) || 0,
      image_url: product.image_url || product.imageUrl,
      sellerId: String(product.sellerId || product.seller_id || ''),
      isSold: Boolean(product.isSold || product.status === 'sold'),
      status: product.status || (product.isSold ? 'sold' : 'available'),
      soldAt: product.soldAt || product.sold_at || null,
      createdAt: product.createdAt || product.created_at || new Date().toISOString(),
      updatedAt: product.updatedAt || product.updated_at || new Date().toISOString(),
      aesthetic: (product.aesthetic || 'noir') as Aesthetic,
    };

    // Add seller information if available
    if (product.seller) {
      transformedProduct.seller = {
        id: String(product.seller.id || ''),
        fullName: product.seller.fullName || product.seller.full_name || 'Unknown Seller',
        email: product.seller.email || '',
        phone: product.seller.phone || '',
        location: product.seller.location || null,
        createdAt: product.seller.createdAt || product.seller.created_at || new Date().toISOString(),
        updatedAt: product.seller.updatedAt || product.seller.updated_at,
        ...(product.seller.bio && { bio: product.seller.bio }),
        ...(product.seller.avatarUrl && { avatarUrl: product.seller.avatarUrl }),
        ...(product.seller.website && { website: product.seller.website }),
        ...(product.seller.socialMedia && { socialMedia: product.seller.socialMedia })
      };
    }

    return transformedProduct;
  };

  // Simplified product fetching logic
  const fetchProducts = useCallback(async () => {
    console.log('Fetching products with filters:', { 
      locationCity, 
      locationArea, 
      selectedAesthetic 
    });
    
    try {
      setLoading(true);
      setError('');
      
      // Build query parameters - city and location are now optional
      const queryParams: any = {};
      
      // Only include city if it's selected
      if (locationCity) {
        queryParams.city = locationCity;
        
        // Only include location (area) if city is selected and location is not empty
        if (locationArea) {
          queryParams.location = locationArea;
        }
      }
      
      console.log('API Request Params:', queryParams);
      
      // Fetch products from the API (will fetch all products if no city is specified)
      let fetchedProducts = await publicApiService.getProducts(queryParams);
      
      console.log('API Response:', { 
        count: fetchedProducts.length,
        firstProduct: fetchedProducts[0] || 'No products',
        hasSeller: !!fetchedProducts[0]?.seller
      });
      
      // Filter by aesthetic if one is selected
      if (selectedAesthetic && selectedAesthetic !== 'all') {
        fetchedProducts = fetchedProducts.filter(
          (product: any) => product.aesthetic === selectedAesthetic
        );
        console.log('After aesthetic filter:', { 
          count: fetchedProducts.length,
          hasSeller: fetchedProducts[0]?.seller ? 'Yes' : 'No'
        });
      }
      
      console.log('Filtered products:', {
        count: fetchedProducts.length,
        firstProduct: fetchedProducts[0] || 'No products',
        hasSeller: fetchedProducts[0]?.seller ? 'Yes' : 'No'
      });
      
      // Transform and set products
      const transformedProducts = fetchedProducts.map(transformProduct);
      
      // Extract sellers from the products that have them
      const sellersFromProducts = transformedProducts.reduce<Record<string, Seller>>((acc, product) => {
        if (product.seller) {
          acc[product.seller.id] = product.seller;
        }
        return acc;
      }, {});
      
      // Set the products with their sellers
      setProducts(transformedProducts);
      
      // If we already have sellers from the products, use them
      if (Object.keys(sellersFromProducts).length > 0) {
        console.log('Using sellers from products:', Object.keys(sellersFromProducts));
        setSellers(sellersFromProducts);
      } else {
        // Fall back to fetching seller info individually
        const uniqueSellerIds = [...new Set(transformedProducts
          .map(p => p.sellerId)
          .filter((id): id is string => !!id)
        )];
        
        if (uniqueSellerIds.length > 0) {
          console.log('Fetching seller info for:', uniqueSellerIds);
          const sellerPromises = uniqueSellerIds.map(async (id) => {
            try {
              const seller = await publicApiService.getSellerInfo(id);
              return seller ? { id, ...seller } : null;
            } catch (error) {
              console.error(`Failed to fetch seller ${id}:`, error);
              return null;
            }
          });

          const sellerResults = await Promise.all(sellerPromises);
          const sellerMap = sellerResults.reduce<Record<string, Seller>>((acc, seller) => {
            if (!seller) return acc;
            
            return {
              ...acc,
              [seller.id]: {
                id: seller.id,
                fullName: seller.fullName || `Seller ${seller.id.slice(0, 6)}`,
                email: seller.email || '',
                phone: seller.phone || '',
                location: seller.location || null,
                createdAt: seller.createdAt || new Date().toISOString(),
                updatedAt: seller.updatedAt || new Date().toISOString()
              }
            };
          }, {});
          
          setSellers(sellerMap);
        } else {
          setSellers({});
        }
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Failed to load products. Please try again later.');
      setProducts([]);
      setSellers({});
    } finally {
      setLoading(false);
    }
  }, [selectedAesthetic, locationCity, locationArea, publicApiService]);

  // Fetch products when any filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts().catch(err => {
        console.error('Error in fetchProducts:', err);
        setError('Failed to load products. Please try again later.');
        setProducts([]);
        setSellers({});
        setLoading(false);
      });
    }, 100);

    // Cleanup function to cancel the fetch if the component unmounts
    return () => {
      clearTimeout(timer);
    };
    // We need to include all dependencies that affect the product listing
  }, [fetchProducts, locationCity, locationArea, selectedAesthetic]);

  // Filter products based on search query, price, and area (city filtering is now done server-side)
  const filteredProducts = products.filter(product => {
    // Filter by price
    const matchesPrice =
      (priceMin == null || product.price >= priceMin) &&
      (priceMax == null || product.price <= priceMax);

    // Filter by area (if specified and not empty)
    const sellerLocationText = (product.seller?.location || '').toLowerCase();
    const locationAreaLower = (locationArea || '').toLowerCase().trim();
    const matchesArea = !locationAreaLower || sellerLocationText.includes(locationAreaLower);

    // If there's a search query, check if it matches product name or description
    if (searchQuery.trim()) {
      const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
      const productText = `${product.name.toLowerCase()} ${product.description.toLowerCase()}`;
      const matchesSearch = searchTerms.every(term => productText.includes(term));
      
      const matches = matchesPrice && matchesArea && matchesSearch;
      
      if (matches) {
        console.log('Product matches all filters (with search):', {
          id: product.id,
          name: product.name,
          price: product.price,
          sellerLocation: product.seller?.location,
          matchesPrice,
          matchesArea,
          matchesSearch
        });
      }
      
      return matches;
    }
    
    const matches = matchesPrice && matchesArea;
    
    if (matches) {
      console.log('Product matches all filters (without search):', {
        id: product.id,
        name: product.name,
        price: product.price,
        sellerLocation: product.seller?.location,
        matchesPrice,
        matchesArea
      });
    }
    
    return matches;
  });
    
  // Function to handle image loading errors
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    console.error('Error loading image:', target.src.substring(0, 100));
    
    // Set a placeholder image
    target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QwZDBkMCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg=';
    target.alt = 'Image not available';
    target.className = 'w-full h-64 object-contain bg-gray-50 p-4';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-200 border-t-yellow-500"></div>
          <p className="text-gray-600 font-medium">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-800 mb-2">Error Loading Products</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Show a message when no aesthetic is selected
  if (!selectedAesthetic) {
    return (
      <div className="text-center py-20">
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-12 max-w-2xl mx-auto shadow-lg border border-gray-200/50">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="h-10 w-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-3xl font-black text-black mb-4">
            Browse Our Collections
          </h3>
          <p className="text-gray-600 text-lg font-medium">
            Please select an aesthetic from above to view the available products.
          </p>
        </div>
      </div>
    );
  }
  
  // Show a message when no products are found for the selected filters
  if (filteredProducts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-12 max-w-2xl mx-auto shadow-lg border border-gray-200/50">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709M15 6.291A7.962 7.962 0 0012 5c-2.34 0-4.29 1.009-5.824 2.709" />
            </svg>
          </div>
          <h3 className="text-3xl font-black text-black mb-4">
            No Products Found
          </h3>
          <p className="text-gray-600 text-lg font-medium">
            {searchQuery
              ? `No products found matching "${searchQuery}"${selectedAesthetic ? ` in ${selectedAesthetic}` : ''}.`
              : `We couldn't find any products matching the selected filters. Please try a different search or aesthetic.`
            }
          </p>
        </div>
      </div>
    );
  }

  // Group filtered products by aesthetic
  const productsByAesthetic = filteredProducts.reduce<Record<string, Product[]>>((acc, product) => {
    const aesthetic = product.aesthetic || 'uncategorized';
    if (!acc[aesthetic]) {
      acc[aesthetic] = [];
    }
    acc[aesthetic].push(product);
    return acc;
  }, {});

  // Get sorted list of aesthetics with product counts
  const aesthetics = Object.entries(productsByAesthetic)
    .map(([aesthetic, products]) => ({
      id: aesthetic,
      name: aesthetic.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      count: products.length
    }))
    .sort((a, b) => b.count - a.count); // Sort by product count

  // If a specific aesthetic is selected, only show that section
  if (selectedAesthetic !== 'all') {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-black text-black mb-2 capitalize">
            {searchQuery 
              ? `Search Results${selectedAesthetic ? ` in ${selectedAesthetic.replace(/-/g, ' ')}` : ''}`
              : `${selectedAesthetic.replace(/-/g, ' ')} Collection`
            }
          </h2>
          <p className="text-gray-600 text-lg font-medium">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} found
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredProducts.map((product) => {
            // Use the seller from the product if available, otherwise try to get it from the sellers map
            const productSeller = product.seller || sellers[product.sellerId];
            
            // Debug log to check seller information
            if (!productSeller) {
              console.warn(`No seller found for product ${product.id} (${product.name})`);
            } else {
              console.log(`Product ${product.id} (${product.name}) has seller:`, {
                sellerId: productSeller.id,
                sellerName: productSeller.fullName,
                sellerLocation: productSeller.location
              });
            }
            
            return (
              <ProductCard
                key={product.id}
                product={product}
                seller={productSeller}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Show all categories with their products
  return (
    <div className="space-y-16">
      <div className="text-center">
        <h2 className="text-4xl font-black text-black mb-4">
          Shop by Aesthetic
        </h2>
        <p className="text-gray-600 text-lg font-medium max-w-2xl mx-auto">
          Browse our curated collections, each with its own unique style and personality.
        </p>
      </div>

      {aesthetics.map(({ id, name, count }) => (
        <section key={id} className="space-y-8" id={`aesthetic-${id}`}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-3xl font-black text-black capitalize">
                {name}
              </h3>
              <p className="text-gray-600 font-medium mt-1">
                {count} {count === 1 ? 'item' : 'items'} available
              </p>
            </div>
            <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 px-4 py-2 text-sm font-bold rounded-xl">
              {count} items
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {productsByAesthetic[id].slice(0, 4).map((product) => {
              // Use the seller from the product if available, otherwise try to get it from the sellers map
              const productSeller = product.seller || sellers[product.sellerId];
              
              // Debug log to check seller information
              if (!productSeller) {
                console.warn(`No seller found for product ${product.id} (${product.name}) in aesthetic ${id}`);
              } else {
                console.log(`Product ${product.id} (${product.name}) in aesthetic ${id} has seller:`, {
                  sellerId: productSeller.id,
                  sellerName: productSeller.fullName,
                  sellerLocation: productSeller.location
                });
              }
              
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  seller={productSeller}
                />
              );
            })}
          </div>

          {productsByAesthetic[id].length > 4 && (
            <div className="text-center">
              <button className="inline-flex items-center text-yellow-600 hover:text-yellow-700 font-semibold transition-colors duration-200">
                View all {count} {name} items
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

export default ProductGrid;
