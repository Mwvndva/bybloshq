/**
 * Middleware to handle double /api prefixes in URLs
 * This ensures that URLs like /api/api/endpoint work the same as /api/endpoint
 */
const fixApiPrefix = (req, res, next) => {
  const originalPath = req.path;
  
  // Only process if the path starts with /api/api/
  if (originalPath.startsWith('/api/api/')) {
    // Remove the first /api from the path
    const newPath = originalPath.replace(/^\/api/, '');
    
    // Update the URL
    console.log(`[${new Date().toISOString()}] Fixed double API prefix: ${originalPath} -> ${newPath}`);
    req.url = newPath + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '');
  }
  
  next();
};

export default fixApiPrefix;
