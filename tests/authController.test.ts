import request from 'supertest';
import app from '../src/app';

jest.mock('../src/services/supabase', () => ({
  verifySupabaseToken: jest.fn().mockResolvedValue({
    id: 'user-123',
    phone: '+1234567890',
    name: 'Test User',
    subscription_tier: 'free',
    model_count: 1,
    monthly_generations: 0,
    created_at: new Date(),
    updated_at: new Date(),
  }),
}));

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

describe('Auth Controller', () => {
  it('should return 401 for missing token', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ token: '' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 200 for valid token', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ token: 'valid-token' });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it('should return 400 if phone is missing for sendPhoneOTP', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if phone or otp is missing for verifyPhoneOTP', async () => {
    let res = await request(app).post('/api/auth/verify-otp').send({ phone: '+1234567890' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    res = await request(app).post('/api/auth/verify-otp').send({ otp: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if refresh token is missing for refreshToken', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
