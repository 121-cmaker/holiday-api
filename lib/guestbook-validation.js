export function validateEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'JSON 객체를 보내 주세요.' };
  if (typeof value.name !== 'string' || typeof value.message !== 'string') return { error: '이름과 내용은 문자열이어야 합니다.' };
  const name = value.name.trim(), message = value.message.trim();
  if (name.length < 1 || name.length > 20) return { error: '이름은 1~20자로 입력해 주세요.' };
  if (message.length < 1 || message.length > 200) return { error: '내용은 1~200자로 입력해 주세요.' };
  return { name, message };
}
