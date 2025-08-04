import request from 'supertest';
import app from '../src/app';

jest.mock('../src/services/userService', () => ({
  getUserById: jest.fn().mockResolvedValue({
    id: 'user-123',
    phone: '+1234567890',
    name: 'Test User',
    subscription_tier: 'free',
    model_count: 1,
    monthly_generations: 0,
    created_at: new Date(),
    updated_at: new Date(),
  }),
  upgradeUserToPro: jest.fn().mockResolvedValue({
    id: 'user-123',
    subscription_tier: 'pro',
    upgraded_at: new Date(),
  }),
  updateUserProfile: jest.fn().mockResolvedValue({
    id: 'user-123',
    name: 'Updated User',
    phone: '+1234567890',
    subscription_tier: 'free',
    model_count: 1,
    monthly_generations: 0,
    created_at: new Date(),
    updated_at: new Date(),
  }),
  getUserUsage: jest.fn().mockResolvedValue({
    generations: 10,
    uploads: 5,
  }),
  logUserAction: jest.fn(),
}));

// Mock authentication middleware to always set req.user for authenticated tests
jest.mock('../src/middleware/auth', () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-123',
      phone: '+1234567890',
      name: 'Test User',
      subscription_tier: 'free',
      model_count: 1,
      monthly_generations: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    next();
  }
}));

describe('User Controller', () => {
  it('should return user profile', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it('should return 401 if user is not authenticated for profile', async () => {
    const unauthApp = require('express')();
    unauthApp.use(require('express').json());
    const { getUserProfile } = require('../src/controllers/userController');
    unauthApp.get('/api/users/profile', getUserProfile);
    const res = await request(unauthApp).get('/api/users/profile');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if required fields are missing for updateUserProfile', async () => {
    const res = await request(app).put('/api/users/profile').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 401 if user is not authenticated for usage', async () => {
    const unauthApp = require('express')();
    unauthApp.use(require('express').json());
    const { getUserUsage } = require('../src/controllers/userController');
    unauthApp.get('/api/users/usage', getUserUsage);
    const res = await request(unauthApp).get('/api/users/usage');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if required fields are missing for upgradeUser', async () => {
    const res = await request(app).post('/api/users/upgrade').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
