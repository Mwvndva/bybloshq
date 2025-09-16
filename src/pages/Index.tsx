import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();

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

      <footer className={`py-8 border-t ${location.pathname === '/' ? 'bg-yellow-300 border-yellow-300' : 'bg-white border-gray-200'} text-black`}>
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Byblos. All rights reserved.
          </p>
          <p className="text-gray-500 text-xs">Powered by Evolve</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
