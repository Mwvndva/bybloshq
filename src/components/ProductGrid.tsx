
import { useMemo } from 'react';
import { ProductCard } from './ProductCard';
import { Product } from '@/types';
import { ProductGridProps } from '@/types/components';
import { usePublicProductsGrid } from './product-grid/usePublicProductsGrid';
import type { Theme } from './product-card/productCardUtils';

type PaginationState = {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

const ProductGrid = ({ selectedAesthetic, searchQuery = '', locationCity, locationArea, priceMin, priceMax }: ProductGridProps) => {
  const { error, filteredProducts, loading, pagination, sellers } = usePublicProductsGrid({
    selectedAesthetic,
    searchQuery,
    locationCity,
    locationArea,
    priceMin,
    priceMax
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

  const emptyStateStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e7e5df',
    boxShadow: '0 18px 45px rgba(17, 17, 17, 0.08)'
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-yellow-100 border-t-yellow-500"></div>
          <p className="text-sm font-semibold text-stone-600">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="rounded-3xl p-8 max-w-md mx-auto" style={emptyStateStyle}>
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-stone-950 mb-2">Error loading products</h3>
          <p className="text-sm text-stone-600">{error}</p>
        </div>
      </div>
    );
  }

  // Show a message when no aesthetic is selected
  if (!selectedAesthetic) {
    return (
      <div className="text-center py-20">
        <div className="rounded-3xl p-10 sm:p-12 max-w-2xl mx-auto" style={emptyStateStyle}>
          <div className="w-20 h-20 bg-yellow-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="h-10 w-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold text-stone-950 mb-4">
            Browse Our Collections
          </h3>
          <p className="text-stone-600 text-base sm:text-lg font-normal">
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
        <div className="rounded-3xl p-10 sm:p-12 max-w-2xl mx-auto" style={emptyStateStyle}>
          <div className="w-20 h-20 bg-stone-100 border border-stone-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="h-10 w-10 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709M15 6.291A7.962 7.962 0 0012 5c-2.34 0-4.29 1.009-5.824 2.709" />
            </svg>
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold text-stone-950 mb-4">
            No products found
          </h3>
          <p className="text-stone-600 text-base sm:text-lg font-normal">
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
          <h2 className="mobile-heading mb-2 capitalize">
            {searchQuery
              ? `Search Results${selectedAesthetic ? ` in ${selectedAesthetic.replace(/-/g, ' ')}` : ''}`
              : `${selectedAesthetic.replace(/-/g, ' ')} Collection`
            }
          </h2>
          <p className="text-gray-600 text-lg font-medium">
            Showing {filteredProducts.length} of {pagination.total || filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>
        <div className="grid-mobile-3">
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
                theme={productSeller?.theme as Theme}
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
              <h3 className="mobile-heading-sm capitalize">
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

          <div className="grid-mobile-3">
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
                  theme={productSeller?.theme as Theme}
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


