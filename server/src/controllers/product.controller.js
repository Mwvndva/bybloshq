import ProductService from '../services/product.service.js';
import logger from '../utils/logger.js';
import ImageService from '../services/image.service.js';

// Upload digital file handler
export const uploadDigitalFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }
    const filePath = `uploads/digital_products/${req.file.filename}`;
    res.status(200).json({
      status: 'success',
      data: {
        filePath,
        fileName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    logger.error('Error uploading digital file:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload file' });
  }
};

export const createProduct = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    if (!sellerId) return res.status(401).json({ status: 'error', message: 'Authentication required' });

    // Convert base64 image to file if present
    if (req.body.image_url && ImageService.isBase64Image(req.body.image_url)) {
      req.body.image_url = await ImageService.base64ToFile(req.body.image_url, 'product');
    }

    const product = await ProductService.createProduct(sellerId, req.body);

    res.status(201).json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    const status = error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500;
    res.status(status).json({
      status: 'error',
      message: error.message
    });
  }
};

export const getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const products = await ProductService.getSellerProducts(sellerId);

    // Mapper for response format if needed (service returns snake_case keys from DB object usually)
    // Controller logic previously mapped soldAt etc.
    const mappedProducts = products.map(p => ({
      ...p,
      createdAt: p.created_at,
      isDigital: p.is_digital,
      digitalFileName: p.digital_file_name,
      productType: p.product_type,
      serviceLocations: p.service_locations,
      serviceOptions: p.service_options,
      soldAt: p.sold_at
    }));

    res.status(200).json({
      status: 'success',
      results: mappedProducts.length,
      data: { products: mappedProducts }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch products' });
  }
};

export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    const product = await ProductService.getProduct(id, sellerId);

    const mappedProduct = {
      ...product,
      createdAt: product.created_at,
      isDigital: product.is_digital,
      digitalFileName: product.digital_file_name,
      productType: product.product_type,
      serviceLocations: product.service_locations,
      serviceOptions: product.service_options,
      soldAt: product.sold_at,
      status: product.status || 'published'
    };

    res.status(200).json({
      status: 'success',
      data: { product: mappedProduct }
    });
  } catch (error) {
    logger.error('Error fetching product:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    // Convert base64 image to file if present
    if (req.body.image_url && ImageService.isBase64Image(req.body.image_url)) {
      req.body.image_url = await ImageService.base64ToFile(req.body.image_url, 'product');
    }

    const updatedProduct = await ProductService.updateProduct(sellerId, id, req.body);

    res.status(200).json({
      status: 'success',
      data: { product: updatedProduct }
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    let status = 500;
    if (error.message.includes('not found')) status = 404;
    if (error.message.includes('Unauthorized')) status = 404; // Security: hide existence
    res.status(status).json({ status: 'error', message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    await ProductService.deleteProduct(sellerId, id);

    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    logger.error('Error deleting product:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};
