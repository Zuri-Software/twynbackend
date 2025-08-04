import { verifySupabaseToken, getSupabaseUserProfile } from '../../src/services/supabase';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    auth: {
      getUser: jest.fn(),
      admin: {
        getUserById: jest.fn(),
      },
    },
  }),
}));

describe('Supabase Service', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
      admin: {
        getUserById: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { createClient } = require('@supabase/supabase-js');
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  describe('verifySupabaseToken', () => {
    it('should return user when token is valid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await verifySupabaseToken('valid-token');
      expect(result).toEqual(mockUser);
    });

    it('should return null when token is invalid', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const result = await verifySupabaseToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should handle exceptions', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Network error'));

      const result = await verifySupabaseToken('token');
      expect(result).toBeNull();
    });
  });

  describe('getSupabaseUserProfile', () => {
    it('should return user profile when userId is valid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await getSupabaseUserProfile('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should return null when userId is invalid', async () => {
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' },
      });

      const result = await getSupabaseUserProfile('invalid-id');
      expect(result).toBeNull();
    });

    it('should handle exceptions', async () => {
      mockSupabase.auth.admin.getUserById.mockRejectedValue(new Error('Network error'));

      const result = await getSupabaseUserProfile('user-123');
      expect(result).toBeNull();
    });
  });
});