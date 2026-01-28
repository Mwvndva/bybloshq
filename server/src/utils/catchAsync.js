/**
 * Wraps an async function to catch any errors and pass them to the next middleware.
 * This removes the need for try-catch blocks in every controller.
 * @param {Function} fn - The async function to wrap
 * @returns {Function} Express middleware function
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

export default catchAsync;
