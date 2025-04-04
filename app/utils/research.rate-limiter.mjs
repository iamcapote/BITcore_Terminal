export class RateLimiter {
  constructor(interval) {
    this.interval = interval;
    this.lastRequestTime = 0;
  }

  async waitForNextSlot() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.interval) {
      const waitTime = this.interval - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}