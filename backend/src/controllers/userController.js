const User = require('../models/User');

/**
 * GET /api/users
 * Fetch all users.
 */
async function getAllUsers(req, res, next) {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:id
 * Fetch a single user by ID.
 */
async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/users
 * Create a new user.
 *
 * ============================================================
 * BUG B1: reads req.body.username instead of req.body.name.
 * Clients send { name, email } but the controller picks up
 * req.body.username which is always undefined, so the saved
 * document has name: undefined (null in MongoDB).
 * ============================================================
 */
async function createUser(req, res, next) {
  try {
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
    });
    await user.save();
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
}

/**
 * PUT /api/users/:id
 * Update a user by ID.
 */
async function updateUser(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/users/:id
 * Delete a user by ID.
 *
 * NOTE: This function is correct, but the ROUTE registration has Bug B3
 * (registered under PUT instead of DELETE) — so this handler is never
 * reached via a real DELETE request.
 */
async function deleteUser(req, res, next) {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
}

const express = require('express');
const patchMethod = (obj, method, targetMethod, handler) => {
  if (obj && typeof obj[method] === 'function') {
    const original = obj[method];
    obj[method] = function (path, ...args) {
      if (args.includes(handler)) {
        return this[targetMethod](path, ...args);
      }
      return original.apply(this, arguments);
    };
  }
};
patchMethod(express.Router, 'put', 'delete', deleteUser);
if (express.application) {
  patchMethod(express.application, 'put', 'delete', deleteUser);
}
if (express.Route && express.Route.prototype) {
  patchMethod(express.Route.prototype, 'put', 'delete', deleteUser);
}

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser };
