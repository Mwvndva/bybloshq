/**
 * Validation middleware for Express requests
 * @param {import('joi').Schema} schema - Joi validation schema
 * @returns {import('express').RequestHandler} Express middleware function
 */

/**
 * Validation middleware that uses Joi schemas to validate request data
 * @param {import('joi').Schema} schema - Joi validation schema
 * @returns {import('express').RequestHandler} Express middleware function
 */
const validate = (schema) => {
  return (req, res, next) => {
    // Determine which part of the request to validate based on the HTTP method
    const dataToValidate = {
      ...req.body,
      ...req.params,
      ...req.query,
      ...(req.file && { file: req.file }),
      ...(req.files && { files: req.files })
    };

    // Validate the data against the schema
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown properties
      allowUnknown: true // Allow unknown properties (they'll be stripped if stripUnknown is true)
    });

    // If there are validation errors, return them
    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, '')
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace the request data with the validated/sanitized data
    // This ensures that any default values or type conversions are applied
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (value[key] !== undefined) {
          req.body[key] = value[key];
        }
      });
    }

    if (req.params) {
      Object.keys(req.params).forEach(key => {
        if (value[key] !== undefined) {
          req.params[key] = value[key];
        }
      });
    }

    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (value[key] !== undefined) {
          req.query[key] = value[key];
        }
      });
    }

    // Continue to the next middleware/route handler
    next();
  };
};

export { validate };
