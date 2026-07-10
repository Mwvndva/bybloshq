import { aestheticCategories } from './aestheticCategoriesData';
import type { Aesthetic } from '../types';
import { AestheticWithNone, AestheticCategoriesProps } from '@/types/components';

export interface AestheticCategory {
  id: Aesthetic;
  title: string;
  description: string;
  wornBy: string;
  vibe: string;
  color: string;
  hoverColor: string;
  accent: string;
  featured?: boolean;
}



const AestheticCategories = ({ onAestheticChange, selectedAesthetic }: AestheticCategoriesProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Shop by Style</h3>
        {selectedAesthetic && (
          <button
            onClick={() => onAestheticChange('' as Aesthetic)}
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {aestheticCategories.map((category) => (
          <button
            key={category.id}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
              ${selectedAesthetic === category.id
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg'
                : 'bg-gray-900/50 text-gray-200 border border-gray-700 hover:border-yellow-400/60 hover:bg-gray-800/70'
              }
            `}
            onClick={() => onAestheticChange(category.id)}
          >
            {category.title}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AestheticCategories;


