# Observability & Telemetry Standards

All Ticket D-Saster services must emit telemetry adhering to standard Prometheus metrics and Loki JSON logging formats.

---

## 1. Prometheus Metrics Standard

Expose endpoint `/metrics` for Prometheus scraping:

### Required Standard Metrics:
- `http_requests_total{method="GET|POST", path="/...", status="200|400|500"}`: Counter of all inbound requests.
- `http_request_duration_seconds{method="...", path="..."}`: Histogram tracking latency buckets (`[0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`).
- `seat_holds_active_gauge{eventId="..."}`: Gauge tracking active in-flight 5-minute reservations.
- `seat_holds_expired_total{eventId="..."}`: Counter tracking seats returned to inventory upon timeout.

### Standard Grafana PromQL Queries:
- **Request Rate (RPS)**:
  ```promql
  sum(rate(http_requests_total[5m])) by (service)
  ```
- **Tail Latency (p95 in seconds)**:
  ```promql
  histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path))
  ```
- **Error Ratio**:
  ```promql
  sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
  ```

---

## 2. Structured JSON Logging for Loki

Do not emit unformatted text strings. Emit single-line JSON with standard fields:

```json
{
  "timestamp": "2026-09-28T08:30:00.123Z",
  "level": "INFO",
  "service": "booking-service",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "message": "Seat hold acquired",
  "context": {
    "eventId": "evt_9981",
    "seatId": "A-14",
    "userId": "usr_4021",
    "expiresAt": "2026-09-28T08:35:00.123Z"
  }
}
```

### Security & Privacy Logging Rules:
- **NEVER** log plain-text credit card numbers, CVVs, expiration dates, or passwords.
- **NEVER** log authorization bearer tokens (`Authorization: Bearer ...`).
- Mask personal identifiers (PII) such as fan national IDs and home addresses.
