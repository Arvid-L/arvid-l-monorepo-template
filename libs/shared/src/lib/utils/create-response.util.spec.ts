import { createResponse } from './create-response.util';

describe('createResponse', () => {
  it('should create Respones', () => {
    const data = [
      {
        id: '1',
      },
      {
        id: '2',
      },
      {
        id: '3',
      },
    ];
    const message = `Returned ${data.length} elements`;

    expect(createResponse(true, message, data)).toEqual({
      success: true,
      data: data,
      message: message,
      timestamp: expect.any(Date),
    });
  });
});
