/**
 * Standardized API response builders for canonical response format.
 * All endpoints should use these builders when SPLIT_DB_READ_MODE=primary.
 */

export interface ApiListResponse<T> {
  success: true;
  data: T[];
  meta: {
    count: number;
    [key: string]: unknown;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export class ApiResponse {
  /**
   * Creates a list response with count metadata.
   * Format: { success: true, data: T[], meta: { count: number } }
   */
  static list<T>(items: T[], count: number, meta?: Record<string, unknown>): ApiListResponse<T> {
    return {
      success: true,
      data: items,
      meta: {
        count,
        ...meta,
      },
    };
  }

  /**
   * Creates a success response for single items.
   * Format: { success: true, data: T, meta?: {...} }
   */
  static success<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      ...(meta && { meta }),
    };
  }

  /**
   * Creates an error response.
   * Format: { success: false, error: string, code?: string }
   */
  static error(message: string, code?: string): ApiErrorResponse {
    return {
      success: false,
      error: message,
      ...(code && { code }),
    };
  }
}
