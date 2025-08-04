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
import express from 'express';
import { handleGenerate } from '../src/controllers/generateController';
import { generateImage } from '../src/services/falService';
import { uploadBuffer } from '../src/services/s3';
import { incrementGenerationCount, logUserAction } from '../src/services/userService';
import multer from 'multer';

jest.mock('../src/services/falService');
jest.mock('../src/services/s3');
jest.mock('../src/services/userService');
jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    storage: {
      upload: jest.fn()
    }
  }
}));

const app = express();
app.use(express.json());
const upload = multer();
app.post('/api/generate', upload.single('lora'), (req, res) => {
  req.user = {
    id: 'test-user',
    phone: '+1234567890',
    subscriptionTier: 'free',
    modelCount: 1,
    monthlyGenerations: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  handleGenerate(req, res);
});

describe('handleGenerate', () => {
  it('should return 400 if prompt is an empty string', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: '', image_url: 'http://example.com/image.png', loraId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Prompt is required/);
  });

  it('should return 400 if image_url is an empty string', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'A test prompt', image_url: '', loraId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Image URL is required/);
  });

  it('should succeed with num_images > 1 and return correct count', async () => {
    (generateImage as jest.Mock).mockResolvedValue({ data: { images: [
      { url: 'http://img.com/1.jpg' },
      { url: 'http://img.com/2.jpg' },
      { url: 'http://img.com/3.jpg' }
    ] } });
    (uploadBuffer as jest.Mock)
      .mockResolvedValueOnce('https://s3.com/1.jpg')
      .mockResolvedValueOnce('https://s3.com/2.jpg')
      .mockResolvedValueOnce('https://s3.com/3.jpg');
    const res = await request(app)
      .post('/api/generate')
      .field('prompt', 'A test prompt')
      .field('image_url', 'http://example.com/image.png')
      .field('loraId', '123')
      .field('num_images', '3');
    expect(res.status).toBe(200);
    expect(res.body.images.length).toBe(3);
    expect(res.body.count).toBe(3);
    expect(res.body.images).toEqual([
      'https://s3.com/1.jpg',
      'https://s3.com/2.jpg',
      'https://s3.com/3.jpg'
    ]);
  });

  it('should succeed with optional params (strength, guidance_scale)', async () => {
    (generateImage as jest.Mock).mockResolvedValue({ data: { images: [{ url: 'http://img.com/1.jpg' }] } });
    (uploadBuffer as jest.Mock).mockResolvedValueOnce('https://s3.com/1.jpg');
    const res = await request(app)
      .post('/api/generate')
      .field('prompt', 'A test prompt')
      .field('image_url', 'http://example.com/image.png')
      .field('loraId', '123')
      .field('strength', '0.5')
      .field('guidance_scale', '7.0');
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual(['https://s3.com/1.jpg']);
    expect(res.body.count).toBe(1);
  });

  it('should call incrementGenerationCount and logUserAction with correct args', async () => {
    (generateImage as jest.Mock).mockResolvedValue({ data: { images: [{ url: 'http://img.com/1.jpg' }] } });
    (uploadBuffer as jest.Mock).mockResolvedValueOnce('https://s3.com/1.jpg');
    const res = await request(app)
      .post('/api/generate')
      .field('prompt', 'A test prompt')
      .field('image_url', 'http://example.com/image.png')
      .field('loraId', '123');
    expect(incrementGenerationCount).toHaveBeenCalledWith('test-user', 1);
    expect(logUserAction).toHaveBeenCalledWith('test-user', 'generate', 1, expect.objectContaining({ prompt: 'A test prompt', imageCount: 1 }));
  });

  it('should handle S3 upload error for one image and succeed for others', async () => {
    (generateImage as jest.Mock).mockResolvedValue({ data: { images: [
      { url: 'http://img.com/1.jpg' },
      { url: 'http://img.com/2.jpg' }
    ] } });
    (uploadBuffer as jest.Mock)
      .mockResolvedValueOnce('https://s3.com/1.jpg')
      .mockRejectedValueOnce(new Error('S3 upload failed'));
    const res = await request(app)
      .post('/api/generate')
      .field('prompt', 'A test prompt')
      .field('image_url', 'http://example.com/image.png')
      .field('loraId', '123');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/S3 upload failed/);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    require('@fal-ai/client').fal.storage.upload.mockReset();
  });

  it('should return 400 if user is not authenticated', async () => {
    const unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.post('/api/generate', handleGenerate);
    const res = await request(unauthApp)
      .post('/api/generate')
      .send({ prompt: 'A test prompt', image_url: 'http://example.com/image.png', loraId: '123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/User not authenticated/);
  });

  it('should return 400 if prompt is missing', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ image_url: 'http://example.com/image.png', loraId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Prompt is required/);
  });

  it('should return 400 if image_url is missing', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'A test prompt', loraId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Image URL is required/);
  });

  it('should return 400 if LoRA file is missing and loraId is not provided', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'A test prompt', image_url: 'http://example.com/image.png' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/LoRA file is required/);
  });

  it('should return 400 if LoRA file is invalid', async () => {
    // Simulate req.file with missing buffer/mimetype
    const invalidApp = express();
    invalidApp.use(express.json());
    invalidApp.post('/api/generate', (req, res) => {
      req.user = {
        id: 'test-user',
        phone: '+1234567890',
        subscriptionTier: 'free',
        modelCount: 1,
        monthlyGenerations: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      req.file = {
        fieldname: 'lora',
        originalname: 'lora.safetensors',
        encoding: '7bit',
        mimetype: '',
        size: 0,
        buffer: Buffer.alloc(0),
        stream: {} as any,
        destination: '',
        filename: 'lora.safetensors',
        path: ''
      };
      handleGenerate(req, res);
    });
    const res = await request(invalidApp)
      .post('/api/generate')
      .field('prompt', 'A test prompt')
      .field('image_url', 'http://example.com/image.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/LoRA file is invalid/);
  });

  it('should handle Fal upload errors gracefully', async () => {
    // Simulate req.file with buffer/mimetype
    const uploadErrorApp = express();
    uploadErrorApp.use(express.json());
    uploadErrorApp.post('/api/generate', (req, res) => {
      req.user = {
        id: 'test-user',
        phone: '+1234567890',
        subscriptionTier: 'free',
        modelCount: 1,
        monthlyGenerations: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      req.file = {
        fieldname: 'lora',
        originalname: 'lora.safetensors',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        size: 4,
        buffer: Buffer.from('fake'),
        stream: {} as any,
        destination: '',
        filename: 'lora.safetensors',
        path: ''
      };
      handleGenerate(req, res);
    });
    require('@fal-ai/client').fal.storage.upload.mockRejectedValue(new Error('Fal upload failed'));
    const res = await request(uploadErrorApp)
      .post('/api/generate')
      .field('prompt', 'A test prompt')
      .field('image_url', 'http://example.com/image.png')
      .attach('lora', Buffer.from('fake'), 'lora.safetensors');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Fal upload failed/);
  });

  it('should handle Fal generateImage errors gracefully', async () => {
    (generateImage as jest.Mock).mockRejectedValue(new Error('Fal generateImage failed'));
    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'A test prompt', image_url: 'http://example.com/image.png', loraId: '123' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Fal generateImage failed/);
  });

  it('should handle S3 upload errors gracefully', async () => {
    (generateImage as jest.Mock).mockResolvedValue({ data: { images: [{ url: 'http://img.com/1.jpg' }] } });
    (uploadBuffer as jest.Mock).mockRejectedValue(new Error('S3 upload failed'));
    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'A test prompt', image_url: 'http://example.com/image.png', loraId: '123' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/S3 upload failed/);
  });

  it('should succeed and return image URLs', async () => {
    (generateImage as jest.Mock).mockResolvedValue({ data: { images: [{ url: 'http://img.com/1.jpg' }, { url: 'http://img.com/2.jpg' }] } });
    (uploadBuffer as jest.Mock).mockResolvedValueOnce('https://s3.com/1.jpg').mockResolvedValueOnce('https://s3.com/2.jpg');
    const res = await request(app)
      .post('/api/generate')
      .field('prompt', 'A test prompt')
      .field('image_url', 'http://example.com/image.png')
      .field('loraId', '123');
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual(['https://s3.com/1.jpg', 'https://s3.com/2.jpg']);
    expect(res.body.count).toBe(2);
    expect(res.body.modelId).toBe('123');
    expect(res.body.s3Folder).toMatch(/users\/test-user\/123\/generations/);
  });
});
