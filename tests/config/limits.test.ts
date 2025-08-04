import { 
  getUserLimits, 
  canUserCreateModel, 
  canUserGenerateImages, 
  USAGE_LIMITS 
} from '../../src/config/limits';

describe('Usage Limits Configuration', () => {
  describe('getUserLimits', () => {
    it('should return free tier limits', () => {
      const limits = getUserLimits('free');
      expect(limits).toEqual({
        models: 10,
        monthlyGenerations: 100,
      });
    });

    it('should return pro tier limits', () => {
      const limits = getUserLimits('pro');
      expect(limits).toEqual({
        models: -1,
        monthlyGenerations: -1,
      });
    });
  });

  describe('canUserCreateModel', () => {
    it('should allow free user to create model when under limit', () => {
      const canCreate = canUserCreateModel(5, 'free');
      expect(canCreate).toBe(true);
    });

    it('should prevent free user from creating model when at limit', () => {
      const canCreate = canUserCreateModel(10, 'free');
      expect(canCreate).toBe(false);
    });

    it('should allow pro user to create unlimited models', () => {
      const canCreate = canUserCreateModel(100, 'pro');
      expect(canCreate).toBe(true);
    });
  });

  describe('canUserGenerateImages', () => {
    it('should allow free user to generate when under limit', () => {
      const canGenerate = canUserGenerateImages(50, 'free', 10);
      expect(canGenerate).toBe(true);
    });

    it('should prevent free user from generating when over limit', () => {
      const canGenerate = canUserGenerateImages(95, 'free', 10);
      expect(canGenerate).toBe(false);
    });

    it('should allow pro user to generate unlimited images', () => {
      const canGenerate = canUserGenerateImages(1000, 'pro', 100);
      expect(canGenerate).toBe(true);
    });

    it('should use default count of 1 when not specified', () => {
      const canGenerate = canUserGenerateImages(99, 'free');
      expect(canGenerate).toBe(true);
    });
  });
});