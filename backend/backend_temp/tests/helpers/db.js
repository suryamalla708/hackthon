/**
 * In-memory MongoDB helper for Jest tests.
 * Uses mongodb-memory-server so no Atlas URI is needed during testing.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

/**
 * Start the in-memory MongoDB server and connect Mongoose to it.
 */
async function connect() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log(`[TEST DB] Connected to in-memory MongoDB at ${uri}`);
}

/**
 * Drop all data, close connection, and stop the in-memory server.
 */
async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
  console.log('[TEST DB] Disconnected and stopped in-memory MongoDB');
}

/**
 * Clear all collections between tests.
 */
async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, disconnect, clearCollections };
