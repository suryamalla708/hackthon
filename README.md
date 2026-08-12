# RepairAI — PS-04

> An AI agent that automatically detects, diagnoses, and patches broken Node.js/Express APIs.

## Project Structure

```
hackthom/
├── backend/              ← Broken Express API + Jest/Supertest tests (Phase 1)
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   └── tests/
└── README.md
```

## Phase 1: Intentionally Broken API

The backend ships with **5 seeded bugs** to drive the AI repair agent:

| Bug | Location | Description |
|-----|----------|-------------|
| B1 | `userController.js` | `req.body.username` instead of `req.body.name` |
| B2 | `productController.js` | Missing `await` on `product.save()` |
| B3 | `routes/users.js` | DELETE route registered as `router.put` |
| B4 | `productController.js` | Division by zero (`price / 0 = Infinity`) |
| B5 | `middleware/errorHandler.js` | Missing `err` param — not recognized as error handler |

## Running Tests (Phase 1)

```bash
cd backend
npm install
npm test
```

**Expected output**: Several tests fail with descriptive error messages exposing the bugs above.

## Environment Setup

```bash
cp .env.example .env
# Fill in your MONGODB_URI for the dev server (tests use in-memory MongoDB)
```
