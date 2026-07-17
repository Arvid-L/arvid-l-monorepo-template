import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

// Builds a JWT-shaped `header.payload.signature` string whose middle
// segment is the base64url encoding of `payload` — only that segment has to
// decode, which mirrors exactly what TokenStorageService.role reads.
const makeToken = (payload: object): string => {
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${body}.signature`;
};

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
  });

  afterEach(() => localStorage.clear());

  describe('role', () => {
    it('returns the role claim from a valid token', () => {
      service.store(makeToken({ sub: 'user-1', role: 'admin' }), 'refresh');

      expect(service.role).toBe('admin');
    });

    it('returns null when the payload has no role claim', () => {
      service.store(makeToken({ sub: 'user-1' }), 'refresh');

      expect(service.role).toBeNull();
    });

    it('returns null when the role claim is not a string', () => {
      service.store(makeToken({ sub: 'user-1', role: 42 }), 'refresh');

      expect(service.role).toBeNull();
    });

    it('returns null when no token is stored', () => {
      expect(service.role).toBeNull();
    });

    it('returns null for a malformed token without throwing', () => {
      service.store('not-a-jwt', 'refresh');

      expect(() => service.role).not.toThrow();
      expect(service.role).toBeNull();
    });

    it('returns null when the payload segment is not valid JSON', () => {
      service.store('header.not-base64-json.signature', 'refresh');

      expect(service.role).toBeNull();
    });
  });
});
