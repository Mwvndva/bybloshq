
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
interface HeroSectionProps {
  onExploreClick?: () => void;
}

const HeroSection = ({ onExploreClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[82dvh] flex items-center justify-center overflow-hidden bg-black">
      {/* Background with deep blur and subtle movement */}
      <div
        className="absolute inset-0 z-0 opacity-100"
        style={{
          background: 'radial-gradient(circle at center, #0b0b0b 0%, #030303 55%, #000000 100%)',
          backgroundColor: '#000000'
        }}
      />

      {/* Subtle Grid Pattern for texture */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Dynamic light blobs for depth */}
      <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-yellow-300/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[25rem] h-[25rem] bg-white/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full px-6 sm:px-10 lg:px-16">
        <div className="flex flex-col items-center text-center space-y-12">

          {/* Main Title Group */}
          <div className="space-y-5">
            <h1 className="text-6xl sm:text-7xl md:text-9xl font-light text-white leading-none tracking-normal">
              BYBLOS
            </h1>

            <p className="text-xl sm:text-2xl md:text-3xl text-white font-light leading-tight tracking-normal">
              Give Your Business A Social Identity
            </p>
          </div>

          {/* Minimal CTA Group */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link to="/buyer/login">
              <Button
                className="bg-white/10 text-white hover:bg-white/15 border border-white/20 rounded-full px-10 py-6 text-lg font-medium transition-all duration-300 shadow-lg group"
              >
                View Businesses
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/seller/register">
              <Button
                className="bg-yellow-400 hover:bg-yellow-300 text-black rounded-full px-10 py-6 text-lg font-medium transition-all duration-300 shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] group"
              >
                Become a Trusted Business
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
