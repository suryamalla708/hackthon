const Product = require('../models/Product');

/**
 * GET /api/products
 * Fetch all products.
 */
async function getAllProducts(req, res, next) {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:id
 * Fetch a single product by ID with computed discount price.
 *
 * ============================================================
 * BUG B4: Division by zero in price calculation.
 * discountedPrice = product.price / 0  →  Infinity (or NaN).
 * JavaScript does not throw on division by zero with floats;
 * it silently produces Infinity. The client receives a price
 * field with value Infinity (serialized as null in JSON.stringify).
 * ============================================================
 */
async function getProductById(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const discountPercent = 0; // BUG B4: discount divisor is 0 → price / 0 = Infinity
    const discountedPrice = product.price / discountPercent;

    res.status(200).json({
      success: true,
      data: {
        ...product.toObject(),
        discountedPrice, // Infinity (serialized as null in JSON)
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/products
 * Create a new product.
 *
 * ============================================================
 * BUG B2: Missing 'await' on product.save().
 * product.save() returns a Promise. Without await, 'savedProduct'
 * is the Promise object itself — not the resolved document.
 * Accessing savedProduct._id returns undefined (Promises have no
 * _id property). The response is sent before the DB write completes,
 * so the returned _id is undefined and the record may not be persisted.
 * ============================================================
 */
async function createProduct(req, res, next) {
  try {
    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      stock: req.body.stock,
      category: req.body.category,
    });

    const savedProduct = product.save(); // BUG B2: missing await

    res.status(201).json({
      success: true,
      data: {
        _id: savedProduct._id,       // undefined — savedProduct is a Promise
        name: product.name,
        price: product.price,
        stock: product.stock,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/products/:id
 * Update a product by ID.
 */
async function updateProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/products/:id
 * Delete a product by ID.
 */
async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
