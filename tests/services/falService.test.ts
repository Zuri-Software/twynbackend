import { generateImage, getTrainingStatus, trainLoRA } from '../../src/services/falService';

// Mock fal client
jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    run: jest.fn(),
    storage: {
      upload: jest.fn(),
    },
    queue: {
      submit: jest.fn(),
      result: jest.fn(),
      status: jest.fn(),
    },
  },
}));

// Mock JSZip
jest.mock('jszip', () => {
  return jest.fn().mockImplementation(() => ({
    file: jest.fn(),
    generateAsync: jest.fn().mockResolvedValue(Buffer.from('fake-zip-data')),
  }));
});

// Mock s3 service
jest.mock('../../src/services/s3', () => ({
  uploadBuffer: jest.fn().mockResolvedValue('https://example.com/zip-url'),
}));

describe('FAL Service', () => {
  const mockFal = {
    queue: {
      submit: jest.fn(),
      result: jest.fn(),
      status: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { fal } = require('@fal-ai/client');
    Object.assign(fal.queue, mockFal.queue);
    fal.storage = { upload: jest.fn() };
    
    process.env.FAL_KEY = 'test-fal-key';
  });

  describe('generateImage', () => {
    it('should generate image successfully', async () => {
      const mockResponse = {
        data: {
          images: [
            { url: 'https://fal.fake/image1.jpg' }
          ]
        }
      };
      
      // Mock fal.run instead of queue.result
      const mockFalRun = jest.fn().mockResolvedValue(mockResponse);
      const { fal } = require('@fal-ai/client');
      fal.run = mockFalRun;

      const input = {
        prompt: 'A cat',
        image_url: 'https://example.com/image.png',
        loras: [{ path: 'lora-123' }],
      };

      const result = await generateImage(input);
      expect(result).toEqual(mockResponse);
      expect(mockFalRun).toHaveBeenCalledWith('fal-ai/flux-lora/image-to-image', { input });
    });

    it('should handle generation errors', async () => {
      const mockFalRun = jest.fn().mockRejectedValue(new Error('Generation failed'));
      const { fal } = require('@fal-ai/client');
      fal.run = mockFalRun;

      const input = {
        prompt: 'A cat',
        image_url: 'https://example.com/image.png',
        loras: [{ path: 'lora-123' }],
      };

      await expect(
        generateImage(input)
      ).rejects.toThrow('Generation failed');
    });
  });

  describe('getTrainingStatus', () => {
    it('should get training status successfully', async () => {
      const mockStatus = { status: 'completed', progress: 100 };
      const { fal } = require('@fal-ai/client');
      fal.queue.status = jest.fn().mockResolvedValue(mockStatus);

      const result = await getTrainingStatus('training-123');
      expect(result).toEqual(mockStatus);
      expect(fal.queue.status).toHaveBeenCalledWith('fal-ai/flux-lora-fast-training', { requestId: 'training-123' });
    });

    it('should handle status check errors', async () => {
      const { fal } = require('@fal-ai/client');
      fal.queue.status = jest.fn().mockRejectedValue(new Error('Status check failed'));

      await expect(
        getTrainingStatus('training-123')
      ).rejects.toThrow('Status check failed');
    });
  });

  describe('trainLoRA', () => {
    it('should start training successfully', async () => {
      const mockTrainingId = 'training-123';
      const { fal } = require('@fal-ai/client');
      fal.storage.upload = jest.fn().mockResolvedValue('https://fal.fake/zip-url');
      fal.queue.submit = jest.fn().mockResolvedValue({ request_id: mockTrainingId });

      const imageBuffers = [Buffer.from('fake-image-data')];
      const result = await trainLoRA(imageBuffers);
      expect(result).toBe(mockTrainingId);
    });

    it('should handle training start errors', async () => {
      const { fal } = require('@fal-ai/client');
      fal.storage.upload = jest.fn().mockResolvedValue('https://fal.fake/zip-url');
      fal.queue.submit = jest.fn().mockRejectedValue(new Error('Training start failed'));

      const imageBuffers = [Buffer.from('fake-image-data')];
      await expect(
        trainLoRA(imageBuffers)
      ).rejects.toThrow('Training start failed');
    });
  });
});