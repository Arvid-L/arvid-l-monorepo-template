import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('verifies a hashed password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces unique hashes per call (random salt)', () => {
    expect(hashPassword('same')).not.toEqual(hashPassword('same'));
  });

  it('rejects malformed stored values', () => {
    expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
  });
});
