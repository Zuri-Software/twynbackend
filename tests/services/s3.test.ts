import { uploadBuffer, deleteS3Folder } from '../../src/services/s3';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
  DeleteObjectsCommand: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-123'),
}));

describe('S3 Service', () => {
  const mockS3Send = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    const { S3Client } = require('@aws-sdk/client-s3');
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockS3Send,
    }));
    
    // Set required env vars
    process.env.S3_BUCKET = 'test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.AWS_REGION = 'us-east-1';
  });

  it('should upload buffer to S3 successfully', async () => {
    mockS3Send.mockResolvedValueOnce({});
    
    const result = await uploadBuffer(
      Buffer.from('test data'),
      'test-folder',
      'image/jpeg'
    );
    
    expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test-folder/mock-uuid-123');
    expect(mockS3Send).toHaveBeenCalledTimes(1);
  });

  it('should handle upload errors', async () => {
    mockS3Send.mockRejectedValueOnce(new Error('Upload failed'));
    
    await expect(
      uploadBuffer(Buffer.from('test data'), 'test-folder', 'image/jpeg')
    ).rejects.toThrow('Upload failed');
  });

  it('should delete S3 folder successfully', async () => {
    // Mock list objects response
    mockS3Send
      .mockResolvedValueOnce({
        Contents: [
          { Key: 'test-folder/file1.jpg' },
          { Key: 'test-folder/file2.jpg' }
        ]
      })
      .mockResolvedValueOnce({}); // delete response
    
    await deleteS3Folder('test-folder');
    
    expect(mockS3Send).toHaveBeenCalledTimes(2);
  });

  it('should handle empty folder deletion', async () => {
    mockS3Send.mockResolvedValueOnce({ Contents: undefined });
    
    await deleteS3Folder('empty-folder');
    
    expect(mockS3Send).toHaveBeenCalledTimes(1);
  });
});