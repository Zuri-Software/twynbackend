// Mock authentication middleware to always set req.user for authenticated requests
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
import request from 'supertest';
import app from '../src/app';

jest.mock('../src/services/s3', () => ({
  uploadBuffer: jest.fn().mockResolvedValue('https://mocked-s3-url.com/onboarding/image.png'),
}));

describe('Onboarding Controller', () => {
  it('should upload onboarding image', async () => {
    const res = await request(app)
      .post('/api/onboarding/upload')
      .set('Authorization', 'Bearer mock-token')
      .attach('image', Buffer.from('fake-image-data'), 'image.jpeg');
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/mocked-s3-url/);
  });

  it('should return 400 if image file is missing', async () => {
    const res = await request(app).post('/api/onboarding/upload').set('Authorization', 'Bearer mock-token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 401 if user is not authenticated', async () => {
    const unauthApp = require('express')();
    unauthApp.use(require('express').json());
    const { handleOnboardingImageUpload } = require('../src/controllers/onboardingController');
    unauthApp.post('/api/onboarding/upload', handleOnboardingImageUpload);
    const res = await request(unauthApp).post('/api/onboarding/upload').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
