import request from 'supertest';
import express from 'express';
import imagesRouter from '../src/routes/images';

// Mock the S3 service
jest.mock('../src/services/s3', () => ({
  listImages: jest.fn().mockResolvedValue([
    'https://bucket.s3.region.amazonaws.com/generated/image1.jpg',
    'https://bucket.s3.region.amazonaws.com/generated/image2.jpg'
  ])
}));

const app = express();
app.use('/api/images', imagesRouter);

describe('GET /api/images', () => {
  it('should return list of generated images', async () => {
    const response = await request(app)
      .get('/api/images')
      .expect(200);

    expect(response.body).toHaveProperty('images');
    expect(response.body).toHaveProperty('count');
    expect(response.body.count).toBe(2);
    expect(response.body.images).toEqual([
      'https://bucket.s3.region.amazonaws.com/generated/image1.jpg',
      'https://bucket.s3.region.amazonaws.com/generated/image2.jpg'
    ]);
  });

  it('should handle errors gracefully', async () => {
    const { listImages } = require('../src/services/s3');
    listImages.mockRejectedValueOnce(new Error('S3 connection failed'));

    const response = await request(app)
      .get('/api/images')
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.images).toEqual([]);
    expect(response.body.count).toBe(0);
  });
});