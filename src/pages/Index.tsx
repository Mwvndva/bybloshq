import HeroSection from '@/components/HeroSection';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const IndexPage = () => {
  const handleExploreClick = () => {
    // This can be left empty or can scroll to content if needed
  };

  const handleEventsClick = () => {
    window.location.href = '/events';
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <HeroSection 
        onExploreClick={handleExploreClick}
        onEventsClick={handleEventsClick}
      />
      
      <Footer />
    </div>
  );
};

export default IndexPage;
