import request from 'supertest';
import express from 'express';
import { getImages } from '../src/controllers/imagesController';
import { getTrainingImagesForModel, deleteTrainingImagesForModel } from '../src/controllers/imagesController';
import { uploadBuffer } from '../src/services/s3';

jest.mock('../src/services/s3');
// Patch S3 service mocks to always return arrays for successful cases
const s3Mock = require('../src/services/s3');
s3Mock.listImages = jest.fn().mockImplementation((folder: string) => {
  if (folder === 'generated') return ['img1.jpg', 'img2.jpg'];
  throw new Error('S3 connection failed');
});
s3Mock.getTrainingImages = jest.fn().mockImplementation((modelId: string) => {
  if (modelId === 'model-123') return ['train1.jpg', 'train2.jpg'];
  throw new Error('S3 connection failed');
});
s3Mock.deleteTrainingImages = jest.fn().mockImplementation((modelId: string) => {
  if (modelId === 'model-123') return true;
  throw new Error('Delete failed');
});

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

const app = express();
app.use(express.json());
app.get('/api/images', getImages);
app.get('/api/images/train/:modelId', getTrainingImagesForModel);
app.delete('/api/images/train/:modelId', deleteTrainingImagesForModel);

describe('imagesController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch images from S3 and return them', async () => {
    s3Mock.listImages.mockResolvedValueOnce(['img1.jpg', 'img2.jpg']);
    const res = await request(app).get('/api/images');
    expect(res.status).toBe(200);
    expect(res.body.images).toBeDefined();
  });

  it('should handle S3 connection error gracefully', async () => {
    s3Mock.listImages.mockRejectedValueOnce(new Error('S3 connection failed'));
    const res = await request(app).get('/api/images');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/S3 connection failed/);
  });

  it('should fetch training images for a model', async () => {
    s3Mock.getTrainingImages.mockResolvedValueOnce(['train1.jpg', 'train2.jpg']);
    const res = await request(app).get('/api/images/train/model-123');
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual(['train1.jpg', 'train2.jpg']);
  });

  it('should delete training images for a model', async () => {
    s3Mock.deleteTrainingImages.mockResolvedValueOnce(true);
    const res = await request(app).delete('/api/images/train/model-123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should handle error when deleting training images', async () => {
    s3Mock.deleteTrainingImages.mockRejectedValueOnce(new Error('Delete failed'));
    const res = await request(app).delete('/api/images/train/model-123');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Delete failed/);
  });
});
