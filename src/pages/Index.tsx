import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '@/components/HeroSection';
import Header from '@/components/Header';
import AestheticCategories from '@/components/AestheticCategories';
import ProductGrid from '@/components/ProductGrid';
import { AestheticWithNone } from '@/types/components';

const IndexPage = () => {
  const navigate = useNavigate();
  const [selectedAesthetic, setSelectedAesthetic] = useState<AestheticWithNone>('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleExploreClick = () => {
    // Scroll to products section
    const productsSection = document.getElementById('products-section');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleEventsClick = () => {
    navigate('/events');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HeroSection 
        onExploreClick={handleExploreClick}
        onEventsClick={handleEventsClick}
      />
      
      {/* Products Section */}
      <section id="products-section" className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Discover Amazing Products
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore unique items from local sellers across Kenya
            </p>
          </div>
          
          <AestheticCategories
            selectedAesthetic={selectedAesthetic}
            onAestheticChange={setSelectedAesthetic}
          />
          
          <ProductGrid
            selectedAesthetic={selectedAesthetic}
            searchQuery={searchQuery}
          />
        </div>
      </section>
    </div>
  );
};

export default IndexPage;
