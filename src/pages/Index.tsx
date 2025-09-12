import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';

const Index = () => {
  const navigate = useNavigate();

  const handleEventsClick = () => {
    navigate('/events');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main>
        <HeroSection 
          onEventsClick={handleEventsClick} 
        />
      </main>

      <footer className="bg-white text-black py-8 border-t border-gray-200">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Byblos Atelier. All rights reserved.
          </p>
          <p className="text-gray-500 text-xs">Powered by Evolve</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
