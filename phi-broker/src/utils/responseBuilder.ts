/**
 * Standardized API response builders for PHI Broker
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  request_id?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ResponseBuilder {
  /**
   * Creates a success response.
   */
  static success<T>(data: T): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
    };
  }

  /**
   * Creates an error response.
   */
  static error(message: string, code?: string, requestId?: string): ApiErrorResponse {
    return {
      success: false,
      error: message,
      ...(code && { code }),
      ...(requestId && { request_id: requestId }),
    };
  }
}
