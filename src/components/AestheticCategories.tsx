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
}

export const aestheticCategories: AestheticCategory[] = [
  {
    id: 'nairobi noir',
    title: 'Nairobi Noir',
    description: 'All-black outfits, trench coats, sunglasses, Doc Martens',
    wornBy: 'Poets, alt creatives, photographers, moody Tumblr kids',
    vibe: 'Nairobi goth. Think deep, silent power',
    color: 'bg-gray-900 text-white',
    hoverColor: 'hover:bg-gray-800',
    accent: 'border-gray-600'
  },
  {
    id: 'earth girl/boy',
    title: 'Earth Girl/Boy',
    description: 'Earthy tones, sustainable fabrics, natural materials, bohemian vibes',
    wornBy: 'Nature lovers, environmentalists, free spirits',
    vibe: 'Eco-conscious and effortlessly cool',
    color: 'bg-gradient-to-r from-green-800 to-brown-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-green-400'
  },
  {
    id: 'brands',
    title: 'Brands',
    description: 'Logo-heavy, designer pieces, streetwear, hypebeast style',
    wornBy: 'Fashion enthusiasts, trendsetters, hypebeasts',
    vibe: 'Luxury streetwear with a statement',
    color: 'bg-gradient-to-r from-black to-gray-800 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-gold-500'
  },
  {
    id: 'corporate',
    title: 'Corporate',
    description: 'Tailored suits, pencil skirts, button-ups, formal wear',
    wornBy: 'Professionals, executives, business owners',
    vibe: 'Polished and powerful',
    color: 'bg-gradient-to-r from-navy-800 to-gray-700 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-silver-400'
  },
  {
    id: 'street wear',
    title: 'Street Wear',
    description: 'Urban fashion, sneakers, oversized fits, graphic tees',
    wornBy: 'Streetwear enthusiasts, skaters, urban youth',
    vibe: 'Edgy and urban',
    color: 'bg-gradient-to-r from-gray-900 to-gray-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-red-500'
  },
  {
    id: 'baddie',
    title: 'Baddie',
    description: 'Form-fitting outfits, heels, bodycon dresses, trendy accessories',
    wornBy: 'Confident trendsetters, social media influencers',
    vibe: 'Bold and glamorous',
    color: 'bg-gradient-to-r from-pink-600 to-purple-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-pink-300'
  },
  {
    id: 'island boy/girl',
    title: 'Island Boy/Girl',
    description: 'Tropical prints, flowy fabrics, sandals, beachy vibes',
    wornBy: 'Beach lovers, vacationers, tropical souls',
    vibe: 'Relaxed and carefree',
    color: 'bg-gradient-to-r from-blue-500 to-teal-400 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-yellow-300'
  },
  {
    id: 'old money',
    title: 'Old Money',
    description: 'Classic silhouettes, luxury fabrics, timeless pieces',
    wornBy: 'Sophisticated dressers, classic style lovers',
    vibe: 'Elegant and timeless',
    color: 'bg-gradient-to-r from-navy-900 to-brown-800 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-gold-500'
  },
  {
    id: 'gothic',
    title: 'Gothic',
    description: 'Dark colors, leather, lace, dramatic silhouettes',
    wornBy: 'Alternative fashion lovers, goth community',
    vibe: 'Mysterious and dramatic',
    color: 'bg-gradient-to-r from-black to-purple-900 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-purple-500'
  }
];

const AestheticCategories = ({ onAestheticChange, selectedAesthetic }: AestheticCategoriesProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-black">Shop by Style</h3>
        {selectedAesthetic && (
          <button
            onClick={() => onAestheticChange('' as Aesthetic)}
            className="text-sm text-gray-500 hover:text-black transition-colors"
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
                ? 'bg-yellow-500 text-white shadow-sm' 
                : 'bg-white text-gray-700 border border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
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