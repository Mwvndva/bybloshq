import HeroSection from '@/components/HeroSection';
import Footer from '@/components/Footer';

const IndexPage = () => {
  const handleExploreClick = () => {
    // This can be left empty or can scroll to content if needed
  };

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-stone-950 flex flex-col selection:bg-yellow-300 selection:text-black">
      <main className="flex-grow">
        <HeroSection
          onExploreClick={handleExploreClick}
        />
      </main>

      <Footer />
    </div>
  );
};

export default IndexPage;
