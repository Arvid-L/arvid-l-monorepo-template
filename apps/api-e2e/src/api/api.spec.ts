import axios from 'axios';

describe('GET /api', () => {
  it('should return a message', async () => {
    const res = await axios.get(`/api/health`);
    const expected = {
      success: true,
      data: {
        message: 'Healthy',
      },
      message: 'API is running',
      timestamp: expect.any(String),
    };

    expect(res.status).toBe(200);
    expect(res.data).toEqual(expected);
  });
});
