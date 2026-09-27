export type ApiResponse<T = unknown> = {
  message: string;
  success: boolean;
  data?: T;
}

// Export all analytics types
export * from './analytics';
