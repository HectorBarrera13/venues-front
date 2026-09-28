# Resilience Patterns Implementation Checklist

Use this checklist and code pattern reference when implementing fault-tolerant integrations.

---

## 1. Resilience Implementation Patterns

### Pattern A: Timeout & Circuit Breaker (Spring Boot Resilience4j)
```yaml
resilience4j.circuitbreaker:
  instances:
    paymentService:
      slidingWindowSize: 20
      failureRateThreshold: 50
      waitDurationInOpenState: 10s
      permittedNumberOfCallsInHalfOpenState: 5
resilience4j.timelimiter:
  instances:
    paymentService:
      timeoutDuration: 2s
```

```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
@TimeLimiter(name = "paymentService")
public CompletableFuture<PaymentResponse> processPayment(PaymentRequest request) {
    return CompletableFuture.supplyAsync(() -> paymentClient.charge(request));
}

public CompletableFuture<PaymentResponse> paymentFallback(PaymentRequest request, Throwable ex) {
    log.error("Payment service degraded, tripping fallback", ex);
    return CompletableFuture.completedFuture(PaymentResponse.queuedForRetry());
}
```

---

### Pattern B: Retry with Full Jitter (Node.js TypeScript)
```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 100
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === retries - 1 || !isTransientError(err)) {
        throw err;
      }
      // Full jitter: random between 0 and baseDelay * 2^attempt
      const maxDelay = baseDelayMs * Math.pow(2, attempt);
      const delay = Math.random() * maxDelay;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retries exhausted');
}

function isTransientError(err: any): boolean {
  return err.status === 503 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
}
```

---

## 2. In-Service Bulkheads
Isolate internal execution thread pools so that slowness in one dependency (e.g. PDF ticket rendering) does not exhaust the thread pool serving core seat hold reservations:
- Reserve 70% of available worker threads for core booking APIs.
- Dedicate separate thread pools or async queues for outbound emails and report exports.
