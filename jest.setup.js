// Jest setup file
import 'dotenv/config';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_DB = '1'; // Use different DB for tests

// Mock external services for tests
global.fetch = jest.fn();
