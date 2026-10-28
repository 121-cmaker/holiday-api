import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/weather.js';

const call = (query, init) => handler.fetch(new Request(`http://localhost/api/weather${query}`, init));
let fetchMock;

beforeEach(() => { fetchMock = mock.method(globalThis, 'fetch', async () => new Response('{}')); });
afterEach(() => mock.restoreAll());

test('도시 날씨를 필요한 필드만 정리해 200과 캐시 헤더로 돌려준다', async () => {
  let step = 0;
  fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify(step++ === 0
    ? { results: [{ name: '서울특별시', admin1: '서울특별시', country: '대한민국', latitude: 37.57, longitude: 126.98 }] }
    : { current: { temperature_2m: 11, apparent_temperature: 8, weather_code: 0, wind_speed_10m: 7 }, daily: { precipitation_probability_max: [0] } })));
  const response = await call('?city=Seoul');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /s-maxage=600/);
  const body = await response.json();
  assert.deepEqual({ ...body, fetchedAt: Boolean(Date.parse(body.fetchedAt)) }, {
    city: '서울특별시, 서울특별시, 대한민국', temperature: 11, apparentTemperature: 8, weather: '맑음',
    windSpeed: 7, precipitationProbability: 0, fetchedAt: true, source: 'Open-Meteo',
  });
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('잘못된 도시명은 400이며 외부 API를 부르지 않는다', async () => {
  const response = await call('?city=x');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'BAD_CITY');
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('찾지 못한 도시는 404이며 캐시하지 않는다', async () => {
  fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ results: [] })));
  const response = await call('?city=NoSuchPlace');
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).code, 'CITY_NOT_FOUND');
});
