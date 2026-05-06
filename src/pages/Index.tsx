import HeroSection from '@/components/HeroSection';

const IndexPage = () => {
  const handleExploreClick = () => {
    // This can be left empty or can scroll to content if needed
  };

  return (
    <div className="selection:bg-yellow-300 selection:text-black">
      <HeroSection
        onExploreClick={handleExploreClick}
      />
    </div>
  );
};

export default IndexPage;
