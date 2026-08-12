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

Create a `.env` file in the `backend/` directory:
```
# For development/database connection:
MONGODB_URI=your-mongodb-uri

# For the AI Debugging Agent:
GEMINI_API_KEY=your-gemini-api-key
```

## Phase 3: Code Search & Diagnostic Pipeline

The codebase includes automated tools to run tests, collect failing traces, and statically search the codebase for suspect files:

```bash
cd backend
npm run pipeline
```

This runs the failure collection script (`scripts/collectFailures.js`), runs the static code searcher (`scripts/searchCode.js`), and outputs diagnostic logs to:
- `logs/failure-report.json` — Structured JSON report of all Jest failures.
- `logs/code-locations.json` — Scanned suspect files and high-confidence static code matches.

## Phase 4: Automated AI Repair Loop

An automated script that reads code locations and performs search/replace repairs based on Mock or LLM responses:

```bash
cd backend
npm run repair
```

To revert all repairs and restore the codebase back to the intentionally broken state, run:
```bash
npm run revert
```

## Phase 5: RepairAI AI Debugging Agent

A fully autonomous agentic script that reads failing reports, queries Gemini, applies temporary isolated patches, verifies results, and performs self-correcting retries.

### Run the Agent
To start the debugging and repair loop using real LLM calls:
```bash
cd backend
npm run agent
```

To run a verification check in mock-simulated mode to test the retry, backup, and restore capabilities:
```bash
npm run agent -- --mock
```

### Agent Repair Lifecycle
For each failing test case, the agent will:
1. Load the Jest failure report and server request captures.
2. Read the suspect source code file.
3. Query `gemini-3.5-flash` with the complete stack trace and diagnostic findings to identify the root cause and generate a structured JSON patch.
4. Perform an in-place backup (`.bak`) and apply the patch.
5. Invoke targeted Jest tests (`npx jest [file] -t "[testNameRegex]"`) to isolate verification.
6. Auto-revert the changes if tests fail, providing the failure stdout to the next LLM attempt (up to 3 retries).
7. Permanently apply and commit the patch if tests pass.
