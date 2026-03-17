import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.K6_BASE_URL || 'http://app:3000';

const errorRate = new Rate('custom_error_rate');
const slowRouteTime = new Trend('slow_route_duration', true);

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 5,
      duration: '20m',
      exec: 'baselineScenario',
      tags: { scenario: 'baseline' },
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',   target: 10 }, // ramp up
        { duration: '2m',   target: 15 }, // sustain
        { duration: '30s',  target: 0  }, // ramp down
        { duration: '30s',  target: 0  }, // rest
        { duration: '1m',   target: 25 }, // bigger spike
        { duration: '2m',   target: 30 },
        { duration: '30s',  target: 0  },
        { duration: '30s',  target: 0  },
        { duration: '1m',   target: 10 },
        { duration: '2m',   target: 10 },
        { duration: '30s',  target: 0  },
        { duration: '30s',  target: 0  },
        { duration: '1m',   target: 12 },
        { duration: '2m',   target: 12 },
        { duration: '30s',  target: 0  },
        { duration: '30s',  target: 0  },
      ],
      startTime: '1m',
      exec: 'spikeScenario',
      tags: { scenario: 'spike' },
    },
    cache: {
      executor: 'constant-vus',
      vus: 3,
      duration: '20m',
      exec: 'cacheScenario',
      tags: { scenario: 'cache' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:baseline}': ['p(95)<500'],
    'http_req_duration{scenario:cache}': ['p(95)<200'],
    custom_error_rate: ['rate<0.5'],
  },
};

function jsonPost(path, payload) {
  return http.post(`${BASE}${path}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertOk(res, tag) {
  const ok = check(res, { [`${tag}: status 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  errorRate.add(!ok);
  return ok;
}

export function baselineScenario() {
  group('health', () => {
    const res = http.get(`${BASE}/health`);
    assertOk(res, 'health');
  });

  sleep(0.2);

  group('list users', () => {
    const res = http.get(`${BASE}/api/users`);
    assertOk(res, 'list-users');
  });

  sleep(0.2);

  group('list products', () => {
    const res = http.get(`${BASE}/api/products`);
    assertOk(res, 'list-products');
  });

  sleep(0.2);

  group('list products by category', () => {
    const categories = ['software', 'hardware', 'furniture'];
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const res = http.get(`${BASE}/api/products?category=${cat}`);
    assertOk(res, 'products-by-category');
  });

  sleep(0.5);
}

export function spikeScenario() {
  group('slow route', () => {
    const start = Date.now();
    const res = http.get(`${BASE}/api/simulate/slow?min=200&max=2000`, { timeout: '5s' });
    slowRouteTime.add(Date.now() - start);
    assertOk(res, 'slow');
  });

  sleep(0.3);

  group('cpu route', () => {
    const n = 35 + Math.floor(Math.random() * 6); // 35–40
    const res = http.get(`${BASE}/api/simulate/cpu?n=${n}`);
    assertOk(res, 'cpu');
  });

  sleep(0.3);

  group('error route', () => {
    const res = http.get(`${BASE}/api/simulate/error?rate=0.4`);
    // 500s are expected here — track them but don't fail the check
    check(res, { 'error route responded': (r) => r.status === 200 || r.status === 500 });
    errorRate.add(res.status === 500);
  });

  sleep(0.2);

  group('memory route', () => {
    const mb = 5 + Math.floor(Math.random() * 10);
    const res = http.get(`${BASE}/api/simulate/memory?mb=${mb}`);
    assertOk(res, 'memory');
  });

  sleep(0.3);

  group('broken route', () => {
    const res = http.get(`${BASE}/api/simulate/broken`);
    check(res, { 'broken: status 500': (r) => r.status === 500 });
    errorRate.add(res.status !== 500); // only count as error if NOT 500 (unexpected)
  });

  sleep(0.5);
}

export function cacheScenario() {
  const userIds = ['u1', 'u2', 'u3', 'u4', 'u5'];
  const id = userIds[Math.floor(Math.random() * userIds.length)];

  group('get user by id (cached)', () => {
    const res = http.get(`${BASE}/api/users/${id}`);
    check(res, { 'user found or missing': (r) => r.status === 200 || r.status === 404 });
  });

  sleep(0.1);

  group('list all users (cached)', () => {
    const res = http.get(`${BASE}/api/users`);
    assertOk(res, 'cached-list');
  });

  sleep(0.3);
}
