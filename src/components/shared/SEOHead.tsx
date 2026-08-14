import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  canonical?: string;
  noindex?: boolean;
}

const DEFAULT_TITLE = 'Byblos | Start and Run Your Business in Nairobi';
const DEFAULT_DESCRIPTION = 'Byblos gives Nairobi sellers a trusted shop link, secure checkout, order management, delivery support, receipts, refunds, and withdrawals.';
const DEFAULT_IMAGE = 'https://www.byblosafrica.site/images/og-image.jpg';
const DEFAULT_URL = 'https://www.byblosafrica.site/';

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  image,
  url,
  type = 'website',
  canonical,
  noindex = false,
}) => {
  const metaTitle = title ? (title.includes('Byblos') ? title : `${title} | Byblos`) : DEFAULT_TITLE;
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const metaImage = image || DEFAULT_IMAGE;
  const metaUrl = url || (typeof window !== 'undefined' ? window.location.href : DEFAULT_URL);
  const canonicalUrl = canonical || metaUrl;

  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      {import.meta.env.VITE_GOOGLE_SITE_VERIFICATION && (
        <meta name="google-site-verification" content={import.meta.env.VITE_GOOGLE_SITE_VERIFICATION} />
      )}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />

      {/* Twitter Cards */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={metaUrl} />
      <meta property="twitter:title" content={metaTitle} />
      <meta property="twitter:description" content={metaDescription} />
      <meta property="twitter:image" content={metaImage} />
    </Helmet>
  );
};

export default SEOHead;
