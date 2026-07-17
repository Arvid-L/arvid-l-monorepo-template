import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { TokenStorageService } from './token-storage.service';

describe('adminGuard', () => {
  const run = (storage: Partial<TokenStorageService>) =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TokenStorageService, useValue: storage },
      ],
    }).runInInjectionContext(() =>
      adminGuard({} as never, { url: '/admin/users' } as never),
    );

  it('redirects anonymous visitors to login', () => {
    const result = run({ isLoggedIn: false, role: null }) as UrlTree;
    expect(result.toString()).toContain('/login');
  });

  it('redirects non-admins to the start page', () => {
    const result = run({ isLoggedIn: true, role: 'user' }) as UrlTree;
    expect(result.toString()).toBe('/');
  });

  it('admits admins', () => {
    expect(run({ isLoggedIn: true, role: 'admin' })).toBe(true);
  });
});
