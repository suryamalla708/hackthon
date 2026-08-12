/**
 * users.test.js — Supertest integration tests for /api/users
 *
 * Expected failures (intentional bugs):
 *   - POST /api/users  → name is null/undefined (Bug B1)
 *   - DELETE /api/users/:id → 404 (Bug B3: route registered as PUT)
 *
 * Expected passes:
 *   - GET /api/users   → 200 with array
 *   - GET /api/users/:id → 200 with user
 *   - PUT /api/users/:id → 200 with updated user
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const { connect, disconnect, clearCollections } = require('./helpers/db');

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

beforeEach(async () => {
  await clearCollections();
});

// ─────────────────────────────────────────────────────────────
// GET /api/users
// ─────────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  it('should return 200 with an empty array when no users exist', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('should return all users when users exist', async () => {
    // Seed users directly in DB (bypass controller bugs)
    await User.create([
      { name: 'Alice', email: 'alice@test.com' },
      { name: 'Bob', email: 'bob@test.com' },
    ]);

    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/users  — BUG B1 will cause this to fail
// ─────────────────────────────────────────────────────────────
describe('POST /api/users', () => {
  it('[BUG B1] should create a user with the correct name — WILL FAIL (name is undefined)', async () => {
    const payload = { name: 'Charlie', email: 'charlie@test.com' };
    const res = await request(app).post('/api/users').send(payload);

    expect(res.status).toBe(201);
    // Bug B1: controller reads req.body.username (undefined), not req.body.name
    // So res.body.data.name will be null/undefined instead of 'Charlie'
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Charlie'); // ← FAILS: actual is null/undefined
  });

  it('should reject a user creation request with no email', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'NoEmail' });

    // With Bug B5 (errorHandler not recognized by Express), errors bubble to
    // Express default handler — status may not be what we expect
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/users/:id
// ─────────────────────────────────────────────────────────────
describe('GET /api/users/:id', () => {
  it('should return a specific user by ID', async () => {
    const user = await User.create({ name: 'Dana', email: 'dana@test.com' });

    const res = await request(app).get(`/api/users/${user._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('dana@test.com');
  });

  it('should return 404 for a non-existent user ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/users/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/users/:id
// ─────────────────────────────────────────────────────────────
describe('PUT /api/users/:id', () => {
  it('should update a user name', async () => {
    const user = await User.create({ name: 'Eve', email: 'eve@test.com' });

    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .send({ name: 'Eve Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Eve Updated');
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/users/:id  — BUG B3 will cause this to fail
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/users/:id', () => {
  it('[BUG B3] should delete a user and return 200 — WILL FAIL (route registered as PUT)', async () => {
    const user = await User.create({ name: 'Frank', email: 'frank@test.com' });

    const res = await request(app).delete(`/api/users/${user._id}`);

    // Bug B3: DELETE /:id is registered as PUT /:id in routes/users.js
    // Express finds no DELETE route for /:id → falls through to 404 handler
    expect(res.status).toBe(200); // ← FAILS: actual is 404
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('deleted');

    // Verify user is gone from DB
    const deleted = await User.findById(user._id);
    expect(deleted).toBeNull(); // ← Also FAILS: user still exists
  });
});
