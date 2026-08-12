const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// GET /api/products — list all products
router.get('/', productController.getAllProducts);

// GET /api/products/:id — get single product (Bug B4 lives in controller)
router.get('/:id', productController.getProductById);

// POST /api/products — create product (Bug B2 lives in controller)
router.post('/', productController.createProduct);

// PUT /api/products/:id — update product
router.put('/:id', productController.updateProduct);

// DELETE /api/products/:id — delete product
router.delete('/:id', productController.deleteProduct);

module.exports = router;
