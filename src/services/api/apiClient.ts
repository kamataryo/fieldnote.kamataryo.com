import axios, { AxiosInstance } from 'axios';

export class RateLimiter {
  private queue: number[] = [];
  private limit: number;
  private window: number;

  constructor(limit: number = 60, windowMs: number = 60000) {
    this.limit = limit;
    this.window = windowMs;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.queue = this.queue.filter((time) => now - time < this.window);

    if (this.queue.length >= this.limit) {
      const oldestRequest = this.queue[0];
      const waitTime = this.window - (now - oldestRequest) + 100;
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.queue.push(Date.now());
  }
}

export class APIClient {
  protected client: AxiosInstance;
  protected rateLimiter?: RateLimiter;

  constructor(baseURL: string, rateLimiter?: RateLimiter) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.rateLimiter = rateLimiter;
  }

  protected async request<T>(config: any): Promise<T> {
    if (this.rateLimiter) {
      await this.rateLimiter.waitIfNeeded();
    }

    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('API Error:', error.response?.status, error.message);
        throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  protected async requestWithRetry<T>(
    config: any,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await this.request<T>(config);
    } catch (error) {
      if (retries === 0) throw error;

      const isRetryable =
        axios.isAxiosError(error) &&
        (error.response?.status === 429 ||
          (error.response?.status && error.response.status >= 500));

      if (isRetryable) {
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.requestWithRetry<T>(config, retries - 1, delay * 2);
      }

      throw error;
    }
  }
}
