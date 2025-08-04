import request from 'supertest';
import app from '../src/app';

jest.mock('../src/services/s3', () => ({
  deleteS3Folder: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/services/userService', () => ({
  deleteModel: jest.fn().mockResolvedValue(true),
  logUserAction: jest.fn().mockResolvedValue(undefined),
}));

// Mock authentication middleware to always set req.user for authenticated tests
jest.mock('../src/middleware/auth', () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-123',
      phone: '+1234567890',
      name: 'Test User',
      subscriptionTier: 'pro', // Changed to pro to pass requireProUser middleware
      modelCount: 1,
      monthlyGenerations: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    next();
  }
}));

// Mock subscription tier middleware
jest.mock('../src/middleware/subscriptionTier', () => ({
  requireProUser: (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    next();
  }
}));

describe('Model Controller', () => {
  it('should delete a model', async () => {
    const res = await request(app)
      .delete('/api/models/model-123')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 if modelId is missing from route', async () => {
    const res = await request(app)
      .delete('/api/models/')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(404);
  });

  it('should return 401 if user is not authenticated', async () => {
    // Simulate missing req.user
    const unauthApp = require('express')();
    unauthApp.use(require('express').json());
    const { handleDeleteModel } = require('../src/controllers/modelController');
    unauthApp.delete('/api/models/:modelId', handleDeleteModel);
    const res = await request(unauthApp).delete('/api/models/model-123').send();
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  // Add more tests for error branches and edge cases as needed
});
