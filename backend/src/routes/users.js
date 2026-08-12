const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// GET /api/users — list all users
router.get('/', userController.getAllUsers);

// GET /api/users/:id — get single user
router.get('/:id', userController.getUserById);

// POST /api/users — create user (Bug B1 lives in the controller)
router.post('/', userController.createUser);

// PUT /api/users/:id — update user
router.put('/:id', userController.updateUser);

/**
 * ============================================================
 * BUG B3: DELETE route registered as PUT instead of DELETE.
 * A real DELETE /api/users/:id request will hit the PUT handler
 * above (updateUser), NOT deleteUser. Express will receive the
 * DELETE and find no matching route → 404 Not Found.
 * ============================================================
 *
 * FIX: Change router.put to router.delete below.
 */
router.delete('/:id', userController.deleteUser); // BUG B3: should be router.delete

module.exports = router;
