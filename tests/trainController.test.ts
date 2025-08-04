import request from 'supertest';
import app from '../src/app';

jest.mock('../src/services/falService', () => ({
  trainLoRA: jest.fn().mockResolvedValue('mocked-training-id'),
  getTrainingStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
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

describe('Train Controller', () => {
  it('should start training', async () => {
    const res = await request(app)
      .post('/api/train/start')
      .set('Authorization', 'Bearer mock-token')
      .send({ modelId: 'model-123' });
    expect(res.status).toBe(200);
    expect(res.body.trainingId).toBe('mocked-training-id');
  });

  it('should get training status', async () => {
    const res = await request(app)
      .get('/api/train/model-123/status')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('should return 400 if modelId is missing for getTrainingStatus', async () => {
    const res = await request(app).get('/api/train//status');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 401 if user is not authenticated for getTrainingStatus', async () => {
    const unauthApp = require('express')();
    unauthApp.use(require('express').json());
    const { getTrainingStatus } = require('../src/controllers/trainController');
    unauthApp.get('/api/train/:modelId/status', getTrainingStatus);
    const res = await request(unauthApp).get('/api/train/model-123/status');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if required fields are missing for startTraining', async () => {
    const res = await request(app).post('/api/train/start').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 401 if user is not authenticated for startTraining', async () => {
    const unauthApp = require('express')();
    unauthApp.use(require('express').json());
    const { startTraining } = require('../src/controllers/trainController');
    unauthApp.post('/api/train/start', startTraining);
    const res = await request(unauthApp).post('/api/train/start').send({ modelId: 'model-123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
