process.env.FAL_KEY = 'dummy-key';
import 'dotenv/config';
import request from 'supertest';
import app from '../src/app';
import axios from 'axios';

// Mock falService
jest.mock('../src/services/falService', () => ({
  generateImage: jest.fn().mockResolvedValue({
    data: {
      images: [
        { url: 'https://fal.fake/image1.jpg' }
      ]
    }
  }),
  getTrainingStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
  trainLoRA: jest.fn().mockResolvedValue('mocked-training-id'),
}));
jest.mock('../src/services/s3', () => ({
  uploadBuffer: jest.fn().mockResolvedValue('https://mocked-s3-url.com/generated/image.png'),
}));
jest.mock('axios');
(axios.get as jest.Mock).mockResolvedValue({ data: Buffer.from('fake-image-data') });

import { fal } from '@fal-ai/client';
import { generateImage, getTrainingStatus } from '../src/services/falService';
import { uploadBuffer } from '../src/services/s3';

jest.mock('@fal-ai/client', () => ({
  fal: {
    queue: {
      result: jest.fn()
    }
  }
}));

describe('POST /api/generate', () => {
  it('should return 400 if prompt, loraId, or imageURL is missing', async () => {
    const res = await request(app).post('/api/generate').send({ prompt: 'A cat' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should call Fal.ai and return image data (mocked)', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'A cat', loraId: '123', image_url: 'http://example.com/image.png' });
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([
      'https://mocked-s3-url.com/generated/image.png'
    ]);
    expect(generateImage).toHaveBeenCalledWith('A cat', '123', 'http://example.com/image.png');
  });

  it('should call Fal.ai, upload to S3, and return S3 image URLs', async () => {
    // Mock generateImage to return Fal-style output
    (generateImage as jest.Mock).mockResolvedValue({
      data: {
        images: [
          { url: 'https://fal.fake/image1.jpg' }
        ]
      }
    });

    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'A cat', loraId: '123', image_url: 'http://example.com/image.png' });

    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([
      'https://mocked-s3-url.com/generated/image.png'
    ]);
    expect(generateImage).toHaveBeenCalledWith('A cat', '123', 'http://example.com/image.png');
    expect(uploadBuffer).toHaveBeenCalled();
  });
});

describe('POST /api/train', () => {
  it('should start training and return an id', async () => {
    const res = await request(app)
      .post('/api/train')
      .attach('images', Buffer.from('dummy-image-data'), 'test.png'); // <-- send a file
    expect(res.status).toBe(200);
    expect(res.body.requestId).toBe('mocked-training-id');
    // If you mock startTraining, check that it was called with a Buffer array
  });

  it('should return 400 if no images are uploaded', async () => {
    const res = await request(app).post('/api/train');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('GET /api/train/:id/status', () => {
  it('should return training status', async () => {
    const res = await request(app).get('/api/train/mock-id/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(getTrainingStatus).toHaveBeenCalledWith('mock-id');
  });

  it('should return 404 if id param is missing', async () => {
    const res = await request(app).get('/api/train//status');
    expect(res.status).toBe(404);
  });

  it('should return status and no lora_id if training is not completed', async () => {
    (getTrainingStatus as jest.Mock).mockResolvedValue({ status: 'IN_PROGRESS' });
    const res = await request(app).get('/api/train/some-id/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.lora_id).toBeNull();
  });

  it('should upload LoRA to S3 and return S3 URL when training is completed', async () => {
    (getTrainingStatus as jest.Mock).mockResolvedValue({ status: 'COMPLETED' });
    (fal.queue.result as jest.Mock).mockResolvedValue({
      data: {
        diffusers_lora_file: { url: 'https://fal.fake/lora.safetensors' }
      }
    });
    (uploadBuffer as jest.Mock).mockResolvedValue('https://mocked-s3-url.com/loras/lora.safetensors');
    (axios.get as jest.Mock).mockResolvedValue({ data: Buffer.from('fake-lora-data') });

    const res = await request(app).get('/api/train/some-id/status');
    expect(res.status).toBe(200);
    expect(res.body.lora_id).toBe('https://mocked-s3-url.com/loras/lora.safetensors');
  });

  it('should return 500 if getTrainingStatus throws an error', async () => {
    (getTrainingStatus as jest.Mock).mockRejectedValue(new Error('Test error'));
    const res = await request(app).get('/api/train/some-id/status');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Test error');
  });
});
