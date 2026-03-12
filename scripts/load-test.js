import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const homepageDuration = new Trend('homepage_duration', true);
const feedDuration = new Trend('feed_duration', true);
const dailyDuration = new Trend('daily_duration', true);
const profileDuration = new Trend('profile_duration', true);

const BASE_URL = __ENV.BASE_URL || 'https://freeluma.app';

// Ramp to 10K concurrent users
export const options = {
  stages: [
    { duration: '30s', target: 500 },    // Warm up
    { duration: '30s', target: 2000 },   // Ramp up
    { duration: '30s', target: 5000 },   // Push harder
    { duration: '1m', target: 10000 },   // Full load
    { duration: '2m', target: 10000 },   // Sustain peak
    { duration: '30s', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],   // 95% of requests under 3s
    errors: ['rate<0.1'],                // Less than 10% error rate
  },
  // Avoid overwhelming the local machine
  noConnectionReuse: false,
  userAgent: 'FreeLumaLoadTest/1.0',
};

export default function () {
  const pages = [
    { name: 'homepage', fn: homepage },
    { name: 'feed', fn: feedAPI },
    { name: 'daily', fn: dailyContent },
    { name: 'profile', fn: profilePage },
  ];

  // Each VU hits a random page
  const page = pages[Math.floor(Math.random() * pages.length)];
  page.fn();

  // Simulate think time between requests (1-3s)
  sleep(Math.random() * 2 + 1);
}

function homepage() {
  const res = http.get(BASE_URL + '/', {
    tags: { page: 'homepage' },
  });
  homepageDuration.add(res.timings.duration);
  check(res, { 'homepage 2xx': (r) => r.status >= 200 && r.status < 400 });
  errorRate.add(res.status >= 400);
}

function feedAPI() {
  const res = http.get(BASE_URL + '/api/feed?limit=10', {
    tags: { page: 'feed' },
  });
  feedDuration.add(res.timings.duration);
  // Feed requires auth, so 401 is expected — count only 5xx as errors
  check(res, { 'feed not 5xx': (r) => r.status < 500 });
  errorRate.add(res.status >= 500);
}

function dailyContent() {
  // Today's date
  const today = new Date().toISOString().split('T')[0];
  const res = http.get(BASE_URL + `/api/daily-posts/${today}`, {
    tags: { page: 'daily' },
  });
  dailyDuration.add(res.timings.duration);
  check(res, { 'daily not 5xx': (r) => r.status < 500 });
  errorRate.add(res.status >= 500);
}

function profilePage() {
  const res = http.get(BASE_URL + '/profile/freeluma', {
    tags: { page: 'profile' },
  });
  profileDuration.add(res.timings.duration);
  check(res, { 'profile 2xx': (r) => r.status >= 200 && r.status < 400 });
  errorRate.add(res.status >= 400);
}
