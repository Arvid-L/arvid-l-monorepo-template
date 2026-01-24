import { ApiResponse } from '../interfaces/api-response.interface';

export function createResponse<T>(
  success: boolean,
  message: string,
  data?: T,
): ApiResponse<T> {
  return {
    success,
    message,
    data,
    timestamp: new Date(),
  };
}
