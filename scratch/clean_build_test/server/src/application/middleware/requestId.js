import { v4 as uuidv4 } from 'uuid';

/**
 * Adds a unique request ID to each request for better tracking in logs
 */
const requestId = (req, res, next) => {
  // Generate a unique ID for this request
  req.id = uuidv4();
  
  // Set the X-Request-ID header in the response
  res.setHeader('X-Request-ID', req.id);
  
  next();
};

export default requestId;
