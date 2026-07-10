import type { Aesthetic } from '../types';

export const aestheticCategories: {
  id: Aesthetic;
  title: string;
  description: string;
  wornBy: string;
  vibe: string;
  color: string;
  hoverColor: string;
  accent: string;
  featured?: boolean;
}[] = [
  {
    id: 'clothes-style',
    title: 'Clothes & Style',
    description: 'Fashionable clothing and style essentials',
    wornBy: 'Fashion enthusiasts and style-conscious individuals',
    vibe: 'Trendy and fashionable',
    color: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-purple-400',
  },
  {
    id: 'food-lifestyle',
    title: 'Food & Lifestyle',
    description: 'Delicious culinary experiences and lifestyle products',
    wornBy: 'Food lovers and culinary adventurers',
    vibe: 'Gourmet and enjoyable',
    color: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-emerald-400',
  },
  {
    id: 'home-living',
    title: 'Home & Living',
    description: 'Cozy and modern home decor and accessories',
    wornBy: 'Homeowners and design enthusiasts',
    vibe: 'Cozy and elegant',
    color: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-amber-400',
  },
  {
    id: 'tech-gadgets',
    title: 'Tech & Gadgets',
    description: 'Innovative technology and cool gadgets',
    wornBy: 'Tech enthusiasts and early adopters',
    vibe: 'Sleek and innovative',
    color: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-blue-400',
  },
  {
    id: 'outdoor-adventure',
    title: 'Outdoor & Adventure',
    description: 'Gear and apparel for outdoor exploration',
    wornBy: 'Hikers, campers, and adventurers',
    vibe: 'Rugged and adventurous',
    color: 'bg-gradient-to-r from-lime-500 to-green-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-lime-400',
  },
  {
    id: 'beauty-wellness',
    title: 'Beauty & Wellness',
    description: 'Self-care products and wellness essentials',
    wornBy: 'Beauty and wellness enthusiasts',
    vibe: 'Relaxing and refreshing',
    color: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white',
    hoverColor: 'hover:scale-105',
    accent: 'border-pink-400',
  }
];


