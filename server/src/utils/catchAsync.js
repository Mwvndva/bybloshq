/**
 * Wraps an async function to catch any errors and pass them to next()
 * @param {Function} fn - The async function to wrap
 * @returns {Function} A middleware function that handles errors
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

export default catchAsync;
