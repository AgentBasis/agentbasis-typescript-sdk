/**
 * HTTP mocking utilities for tests
 */

import { vi } from 'vitest';

export interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export function createMockFetch(responses: MockResponse[] = []): typeof fetch {
  let callIndex = 0;

  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const response = responses[callIndex] ?? {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
      text: async () => 'OK',
    };

    callIndex++;

    return response as unknown as Response;
  });
}

export function createSuccessResponse(data: unknown = { success: true }): MockResponse {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

export function createErrorResponse(status: number, message: string): MockResponse {
  return {
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => message,
  };
}
