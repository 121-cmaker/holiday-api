import test from 'node:test';
import assert from 'node:assert/strict';
import api from '../api/guestbook.js';
const req = body => new Request('https://example.test/api/guestbook', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('missing keys and database failures are handled without exposing keys', async()=>{
 const saved={...process.env}; const original=globalThis.fetch;
 try {
 for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY']) delete process.env[key];
 assert.equal((await api.fetch(new Request('https://example.test/api/guestbook'))).status,500);
 assert.equal((await api.fetch(req({name:'test',message:'hello'}))).status,500);
 assert.equal((await api.fetch(req({name:'',message:'hello'}))).status,400);
 assert.equal((await api.fetch(req({name:'test',message:'a'.repeat(201)}))).status,400);
 process.env.SUPABASE_URL='https://example.supabase.co';
 process.env.SUPABASE_PUBLISHABLE_KEY='test-public';process.env.SUPABASE_SECRET_KEY='test-secret';
 globalThis.fetch=async()=>new Response(JSON.stringify({message:'mock database error'}),{status:500});
 for(const r of [new Request('https://example.test/api/guestbook'),req({name:'test',message:'hello'})]) {
 const response=await api.fetch(r);assert.equal(response.status,502); assert.equal((await response.text()).includes('test-secret'),false);
 }
 } finally {globalThis.fetch=original; for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY']) {if(saved[key]===undefined) delete process.env[key];else process.env[key]=saved[key];}}
});
