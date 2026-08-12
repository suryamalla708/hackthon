/**
 * products.test.js — Supertest integration tests for /api/products
 *
 * Expected failures (intentional bugs):
 *   - POST /api/products → returned _id is undefined (Bug B2: missing await)
 *   - GET  /api/products/:id → discountedPrice is null/Infinity (Bug B4: division by zero)
 *
 * Expected passes:
 *   - GET /api/products  → 200 with array
 *   - PUT /api/products/:id → 200 with updated product
 *   - DELETE /api/products/:id → 200
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Product = require('../src/models/Product');
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
// GET /api/products
// ─────────────────────────────────────────────────────────────
describe('GET /api/products', () => {
  it('should return 200 with an empty array when no products exist', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('should list all seeded products', async () => {
    await Product.create([
      { name: 'Widget A', price: 9.99, stock: 100 },
      { name: 'Widget B', price: 19.99, stock: 50 },
    ]);

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/products  — BUG B2 will cause this to fail
// ─────────────────────────────────────────────────────────────
describe('POST /api/products', () => {
  it('[BUG B2] should return a valid _id after creation — WILL FAIL (missing await on save)', async () => {
    const payload = { name: 'Gadget X', price: 29.99, stock: 200 };
    const res = await request(app).post('/api/products').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Bug B2: savedProduct is a Promise (not awaited), so savedProduct._id is undefined
    // The response returns { _id: undefined, name: 'Gadget X', ... }
    expect(res.body.data._id).toBeDefined(); // ← FAILS: actual is undefined/null
    expect(mongoose.Types.ObjectId.isValid(res.body.data._id)).toBe(true); // ← Also FAILS
  });

  it('[BUG B2] product should be persisted in DB after creation — MAY FAIL (race condition)', async () => {
    const payload = { name: 'Gizmo Y', price: 49.99, stock: 10 };
    await request(app).post('/api/products').send(payload);

    // Give the unwaited Promise a moment to resolve (it might still save)
    await new Promise((r) => setTimeout(r, 100));

    const count = await Product.countDocuments({ name: 'Gizmo Y' });
    // Without await, the save might or might not complete before countDocuments runs
    // In practice, this is a timing-dependent test showing the danger of missing await
    expect(count).toBe(1); // May or may not fail depending on timing
  });

  it('should reject a product with a negative price', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Bad Product', price: -5, stock: 10 });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/products/:id  — BUG B4 will cause this to fail
// ─────────────────────────────────────────────────────────────
describe('GET /api/products/:id', () => {
  it('[BUG B4] discountedPrice should be a finite number — WILL FAIL (division by zero → Infinity/null)', async () => {
    const product = await Product.create({ name: 'Test Item', price: 100, stock: 5 });

    const res = await request(app).get(`/api/products/${product._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { discountedPrice } = res.body.data;
    // Bug B4: price / 0 = Infinity. JSON.stringify(Infinity) → null in JSON.
    // So discountedPrice will be null in the response body.
    expect(typeof discountedPrice).toBe('number'); // ← FAILS: null is not a 'number'
    expect(isFinite(discountedPrice)).toBe(true);   // ← Also FAILS
    expect(discountedPrice).toBeGreaterThan(0);     // ← Also FAILS
  });

  it('should return 404 for a non-existent product ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/products/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/products/:id
// ─────────────────────────────────────────────────────────────
describe('PUT /api/products/:id', () => {
  it('should update a product price', async () => {
    const product = await Product.create({ name: 'Old Item', price: 10, stock: 5 });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .send({ price: 15.99 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(15.99);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/products/:id
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/products/:id', () => {
  it('should delete a product successfully', async () => {
    const product = await Product.create({ name: 'Delete Me', price: 5, stock: 1 });

    const res = await request(app).delete(`/api/products/${product._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const deleted = await Product.findById(product._id);
    expect(deleted).toBeNull();
  });
});
