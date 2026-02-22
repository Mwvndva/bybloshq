import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Using console.error for 404s — these are meaningful errors worth tracking
    console.error('404: User navigated to non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      {/* Byblos ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-40 top-1/3 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl" />
        <div className="absolute -right-40 bottom-1/3 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-lg mx-auto">
        {/* 404 Glyph */}
        <div className="mb-8">
          <span
            className="text-[10rem] font-black leading-none"
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </span>
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-white mb-4">Page not found</h1>
        <p className="text-gray-400 text-lg mb-10">
          The page at <span className="text-yellow-400 font-mono text-sm bg-yellow-400/10 px-2 py-0.5 rounded">{location.pathname}</span>{' '}
          doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-yellow-400 text-black font-bold text-sm transition-all hover:bg-yellow-300 active:scale-95"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm transition-all hover:bg-white/10 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
