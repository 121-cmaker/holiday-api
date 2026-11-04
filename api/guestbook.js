import { createClient } from '@supabase/supabase-js';
import { validateEntry } from '../lib/guestbook-validation.js';

const headers = { 'Cache-Control': 'no-store' };
const fail = (status, code, error) => Response.json({ code, error }, { status, headers });
function db(key) {
  return createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'POST') return fail(405, 'METHOD', 'GET 또는 POST만 허용합니다.');
    if (request.method === 'POST') {
      if (!/^application\/json\s*(;|$)/i.test(request.headers.get('content-type') ?? '')) return fail(400, 'BAD_JSON', 'JSON으로 보내 주세요.');
      let payload;
      try { payload = await request.json(); } catch { return fail(400, 'BAD_JSON', '올바른 JSON이 아닙니다.'); }
      const entry = validateEntry(payload);
      if (entry.error) return fail(400, 'INVALID_INPUT', entry.error);
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return fail(500, 'NO_KEY', '환경 변수 설정이 필요합니다.');
      try {
        const { data, error } = await db(process.env.SUPABASE_SECRET_KEY).from('guestbook')
          .insert(entry).select('id,name,message,created_at').single();
        if (error) return fail(502, 'DB_ERROR', '저장하지 못했습니다.');
        return Response.json({ item: data }, { status: 201, headers });
      } catch { return fail(502, 'DB_ERROR', '데이터베이스 연결 오류입니다.'); }
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return fail(500, 'NO_KEY', '환경 변수 설정이 필요합니다.');
    try {
      const { data, error } = await db(process.env.SUPABASE_PUBLISHABLE_KEY).from('guestbook')
        .select('id,name,message,created_at').order('created_at', { ascending: false }).limit(20);
      if (error) return fail(502, 'DB_ERROR', '조회하지 못했습니다.');
      return Response.json({ items: data ?? [] }, { headers });
    } catch { return fail(502, 'DB_ERROR', '데이터베이스 연결 오류입니다.'); }
  },
};
