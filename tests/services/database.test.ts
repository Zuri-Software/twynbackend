import { query, getClient, pool } from '../../src/services/database';

// Mock pg
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [{ id: 1, name: 'test' }] }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    on: jest.fn(),
  })),
}));

describe('Database Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a query successfully', async () => {
    const result = await query('SELECT * FROM users WHERE id = $1', ['123']);
    expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
  });

  it('should get a client from pool', async () => {
    const client = await getClient();
    expect(client).toBeDefined();
    expect(client.query).toBeDefined();
    expect(client.release).toBeDefined();
  });

  it('should handle query with no parameters', async () => {
    const result = await query('SELECT * FROM users');
    expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
  });
});