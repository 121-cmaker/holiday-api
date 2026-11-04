import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from '../lib/guestbook-validation.js';
test('valid entry trims whitespace',()=>assert.deepEqual(validateEntry({name:' 민지 ',message:' 좋아요 '}),{name:'민지',message:'좋아요'}));
test('empty name rejected',()=>assert.ok(validateEntry({name:' ',message:'안녕'}).error));
test('201 characters rejected',()=>assert.ok(validateEntry({name:'민지',message:'a'.repeat(201)}).error));
test('non-object rejected',()=>assert.ok(validateEntry(null).error));
test('wrong input types rejected',()=>assert.ok(validateEntry({name:42,message:'안녕'}).error));
test('maximum lengths accepted',()=>assert.equal(validateEntry({name:'x'.repeat(20),message:'y'.repeat(200)}).error,undefined));
