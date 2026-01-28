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

export const aestheticCategories: AestheticCategory[] = [
  {
    id: 'clothes-style',
    title: 'Clothes & Style',
    description: 'Fashionable clothing and style essentials',
    wornBy: 'Fashion enthusiasts and style-conscious individuals',
    vibe: 'Trendy and fashionable',
    color: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-purple-400',
    featured: true
  },
  {
    id: 'sneakers-shoes',
    title: 'Sneakers & Shoes',
    description: 'Stylish footwear for every occasion',
    wornBy: 'Sneakerheads and shoe enthusiasts',
    vibe: 'Urban and sporty',
    color: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-cyan-300'
  },
  {
    id: 'beauty-fragrance',
    title: 'Beauty & Fragrance',
    description: 'Skincare, makeup, and luxury scents',
    wornBy: 'Beauty enthusiasts and self-care lovers',
    vibe: 'Luxurious and pampering',
    color: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-rose-300'
  },
  {
    id: 'art-decor-crafts',
    title: 'Art, Decor & Crafts',
    description: 'Handmade and artistic home decor',
    wornBy: 'Art lovers and home decor enthusiasts',
    vibe: 'Creative and artistic',
    color: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-orange-300'
  },
  {
    id: 'electronics-accessories',
    title: 'Electronics & Accessories',
    description: 'Gadgets and tech accessories',
    wornBy: 'Tech enthusiasts and gadget lovers',
    vibe: 'Modern and high-tech',
    color: 'bg-gradient-to-r from-gray-700 to-gray-900 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-gray-400'
  },
  {
    id: 'home-living',
    title: 'Home & Living',
    description: 'Furniture and home essentials',
    wornBy: 'Homeowners and interior design lovers',
    vibe: 'Cozy and inviting',
    color: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-teal-300'
  },
  {
    id: 'health-wellness',
    title: 'Health & Wellness',
    description: 'Products for a healthy lifestyle',
    wornBy: 'Health-conscious individuals',
    vibe: 'Nourishing and balanced',
    color: 'bg-gradient-to-r from-green-500 to-lime-500 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-lime-300'
  }
];

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