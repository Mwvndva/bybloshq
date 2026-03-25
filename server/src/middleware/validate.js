/**
 * Validation middleware for Express requests using Zod
 * @param {import('zod').ZodSchema} schema - Zod validation schema
 * @returns {import('express').RequestHandler} Express middleware function
 */
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Create data object for validation
      const dataToValidate = {
        ...req.body,
        ...req.params,
        ...req.query,
        ...(req.file && { file: req.file }),
        ...(req.files && { files: req.files })
      };

      // Perform validation (parse will strip unknown if schema is configured, 
      // but we typically use .strict() or .passthrough() in Zod)
      const validatedData = await schema.parseAsync(dataToValidate);

      // Update request objects with validated/sanitized data
      // For Zod, we replace the entire body if it's there
      if (req.body && Object.keys(req.body).length > 0) {
        req.body = validatedData;
      }

      // Update params and query if they contain validated keys
      if (req.params) {
        Object.keys(req.params).forEach(key => {
          if (validatedData[key] !== undefined) {
            req.params[key] = validatedData[key];
          }
        });
      }

      if (req.query) {
        Object.keys(req.query).forEach(key => {
          if (validatedData[key] !== undefined) {
            req.query[key] = validatedData[key];
          }
        });
      }

      next();
    } catch (error) {
      // Handle Zod errors
      if (error.errors) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors
        });
      }

      // Fallback for unexpected errors during validation
      next(error);
    }
  };
};

export { validate };
