const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;
const CACHE_OK = 'public, s-maxage=600, stale-while-revalidate=3600';

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return fail(405, 'METHOD', '이 주소는 GET 요청만 받습니다.');
    }

    const city = (new URL(request.url).searchParams.get('city') ?? '').trim();
    if (city.length < 2 || city.length > 60) {
      return fail(400, 'BAD_CITY', 'city는 2~60자 도시 이름으로 보냅니다. 예: ?city=Seoul');
    }

    try {
      const placeUrl = new URL(GEOCODING_URL);
      placeUrl.search = new URLSearchParams({ name: city, count: '1', language: 'ko', format: 'json' }).toString();
      const placeResponse = await fetch(placeUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!placeResponse.ok) return fail(502, 'UPSTREAM_HTTP', `날씨 위치 서버가 HTTP ${placeResponse.status} 오류로 답했습니다.`);
      const place = (await placeResponse.json())?.results?.[0];
      if (!place) return fail(404, 'CITY_NOT_FOUND', '해당 도시를 찾지 못했습니다. 영문 또는 한글 도시 이름을 확인해 주세요.');

      const weatherUrl = new URL(FORECAST_URL);
      weatherUrl.search = new URLSearchParams({
        latitude: String(place.latitude), longitude: String(place.longitude), timezone: 'Asia/Seoul',
        current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
        daily: 'precipitation_probability_max', forecast_days: '1',
      }).toString();
      const weatherResponse = await fetch(weatherUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!weatherResponse.ok) return fail(502, 'UPSTREAM_HTTP', `날씨 서버가 HTTP ${weatherResponse.status} 오류로 답했습니다.`);
      const data = await weatherResponse.json();
      const current = data?.current;
      if (!current) return fail(502, 'UPSTREAM_FORMAT', '날씨 서버의 응답 형식을 읽지 못했습니다.');

      return Response.json({
        city: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        weather: weatherLabel(current.weather_code),
        windSpeed: current.wind_speed_10m,
        precipitationProbability: data?.daily?.precipitation_probability_max?.[0] ?? null,
        fetchedAt: new Date().toISOString(), source: 'Open-Meteo',
      }, { headers: { 'Cache-Control': CACHE_OK } });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        return fail(502, 'UPSTREAM_TIMEOUT', `날씨 서버가 ${TIMEOUT_MS / 1000}초 안에 답하지 않았습니다. 잠시 뒤 다시 시도해 주세요.`);
      }
      console.error(`[weather] ${error?.name ?? 'unknown'} (${city})`);
      return fail(502, 'UPSTREAM_NETWORK', '날씨 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
  },
};

function fail(status, code, error) {
  return Response.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function weatherLabel(code) {
  if (code === 0) return '맑음';
  if ([1, 2, 3].includes(code)) return '구름 조금';
  if ([45, 48].includes(code)) return '안개';
  if ([51, 53, 55, 56, 57].includes(code)) return '이슬비';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '비';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '눈';
  if ([95, 96, 99].includes(code)) return '뇌우';
  return '날씨 정보';
}
