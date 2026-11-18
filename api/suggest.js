import holidays from './holidays.js';

const ENDPOINT = 'https://open.hasa.re.kr/v1/chat/completions';
const MODEL = 'gemma-4-31b';
const SYSTEM = '당신은 한국외대 유학생에게 이 달에 해 볼 만한 일을 추천하는 도우미입니다. 제공한 공휴일 목록만 날짜의 근거로 쓰세요. 공휴일이 없으면 없다고 밝히고 일반적인 여가 활동을 제안하세요. 휴일, 행사, 날씨, 영업시간을 지어내지 마세요. 번호 붙인 세 줄, 한 줄 40자 이내의 한국어로 답하세요. 광고, 개인정보, 연락처, 링크를 쓰지 마세요. 모르는 사실은 모른다고 하세요.';

// 캐시는 인스턴스별 5분, 동시 요청은 같은 Promise를 공유합니다.
export function createSuggest({ holidayFetch = (request) => holidays.fetch(request), fetchAI = (...args) => fetch(...args), timeoutMs = 20000, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  const fail = (status, code, error, hint) => Response.json({ code, error, hint }, { status, headers: { 'Cache-Control': 'no-store' } });
  return { async fetch(request) {
    if (request.method !== 'GET') return fail(405, 'METHOD', 'GET 요청만 받습니다.');
    const params = new URL(request.url).searchParams;
    const y = params.get('year') ?? '';
    const m = params.get('month') ?? '';
    if (!/^\d{4}$/.test(y) || +y < 2000 || +y > 2099) return fail(400, 'BAD_YEAR', '연도는 2000~2099의 네 자리 숫자로 입력하세요.');
    if (!/^\d{1,2}$/.test(m) || +m < 1 || +m > 12) return fail(400, 'BAD_MONTH', '월은 1~12의 숫자로 입력하세요.');
    const key = process.env.HASA_API_KEY?.trim();
    if (!key) return fail(500, 'NO_KEY', '운영자가 AI 인증키를 설정해야 합니다.', 'Vercel에 HASA_API_KEY를 추가하고 다시 배포하세요.');
    const id = `${+y}-${+m}`;
    const hit = cache.get(id);
    if (hit && hit.expires > now()) return Response.json({ ...hit.data, cached: true }, { headers: { 'Cache-Control': 'no-store' } });
    if (pending.has(id)) return (await pending.get(id)).clone();
    const work = generate();
    pending.set(id, work);
    try { return (await work).clone(); } finally { pending.delete(id); }

    async function generate() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const holidayRequest = new Request(`https://local/api/holidays?year=${+y}&month=${+m}`, { signal: controller.signal });
        const response = await holidayFetch(holidayRequest);
        if (!response.ok) return fail(502, 'HOLIDAYS_FAILED', '공휴일 정보를 확인하지 못해 추천을 만들지 않았습니다.', '공휴일 조회를 다시 시도하세요.');
        const data = await response.json();
        const list = data.items.map(({ date, name }) => ({ date, name }));
        // 자유 입력, 도시 검색어, 방명록, 실명·학번은 전송하지 않습니다.
        const user = JSON.stringify({ year: +y, month: +m, holidays: list });
        if (user.length > 500) return fail(502, 'INPUT_TOO_LONG', '공휴일 자료가 입력 길이 제한을 넘었습니다.');
        const upstream = await fetchAI(ENDPOINT, {
          method: 'POST', signal: controller.signal,
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], max_tokens: 300 }),
        });
        if (upstream.status === 429) return fail(429, 'RATE_LIMIT', 'AI 사용 한도를 초과했습니다.', '잠시 뒤 다시 시도하세요. 개발키는 분당 10회·동시 1건·하루 성공 500건 한도입니다.');
        if (!upstream.ok) return fail(502, 'AI_UPSTREAM', 'AI 서버가 요청을 처리하지 못했습니다.', '잠시 뒤 다시 시도하세요.');
        const answer = await upstream.json();
        const content = answer?.choices?.[0]?.message?.content;
        const lines = typeof content === 'string' ? content.trim().split(/\r?\n/).filter(s => s.trim()) : [];
        const suggestions = lines.map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim());
        if (lines.length !== 3 || !lines.every((s, i) => new RegExp(`^\\s*${i + 1}[.)]\\s*`).test(s)) || suggestions.some(s => !s || [...s].length > 40 || /sk-|https?:|www\.|@|<|>/.test(s)) || content.includes(key)) {
          return Response.json({ year: +y, month: +m, suggestions: [], needsRetry: true, message: '추천 형식이 맞지 않아 표시하지 않았습니다. 다시 받아 주세요.' }, { headers: { 'Cache-Control': 'no-store' } });
        }
        const result = { year: +y, month: +m, suggestions, model: MODEL, holidayCount: list.length, cached: false, generatedAt: new Date(now()).toISOString(), totalTokens: Number.isFinite(answer.usage?.total_tokens) ? answer.usage.total_tokens : null };
        for (const [name, entry] of cache) if (entry.expires <= now()) cache.delete(name);
        if (cache.size >= 24) cache.delete(cache.keys().next().value);
        cache.set(id, { data: result, expires: now() + 300000 });
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        if (controller.signal.aborted || ['AbortError', 'TimeoutError'].includes(error?.name)) return fail(504, 'AI_TIMEOUT', 'AI 추천 대기시간 20초가 지났습니다.', '다시 시도 버튼을 눌러 주세요.');
        return fail(502, 'AI_NETWORK', 'AI 응답을 읽지 못했습니다.', '잠시 뒤 다시 시도하세요.');
      } finally { clearTimeout(timer); }
    }
  } };
}

export default createSuggest();
