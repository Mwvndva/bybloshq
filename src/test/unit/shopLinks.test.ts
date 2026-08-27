import { describe, it, expect } from 'vitest';
import { getShopUrl, getShopUsername, getCreatorShopUrl } from '@/shared/utils/shopLinks';

describe('Canonical Shop Slug URL Generation', () => {
  it('generates canonical shop URL using seller.slug, not mixed-case shop_name', () => {
    const seller = {
      shop_name: 'MyShop',
      slug: 'myshop'
    };

    // When canonical slug is provided, the URL must use the slug
    const url = getShopUrl(seller.slug, 'https://byblosafrica.site');
    expect(url).toBe('https://byblosafrica.site/myshop');
    expect(url).not.toBe('https://byblosafrica.site/MyShop');

    // Display identity is preserved via getShopUsername / shop_name
    const displayName = getShopUsername(seller.shop_name);
    expect(displayName).toBe('MyShop');
  });

  it('generates creator shop URL using canonical slug with creator query parameter', () => {
    const seller = {
      shop_name: 'Urban Attire',
      slug: 'urban-attire'
    };
    const creatorCode = 'BY123XYZ';

    const creatorUrl = getCreatorShopUrl(seller.slug, creatorCode, 'https://byblosafrica.site');
    expect(creatorUrl).toBe('https://byblosafrica.site/urban-attire?creator=BY123XYZ');
  });

  it('handles empty or null slugs gracefully without crashing', () => {
    expect(getShopUrl(null)).toBe('');
    expect(getShopUrl(undefined)).toBe('');
    expect(getShopUrl('')).toBe('');
    expect(getCreatorShopUrl(null, 'CODE')).toBe('');
  });
});
