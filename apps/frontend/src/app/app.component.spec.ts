import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { App } from './app.component';
import { AuthService } from './core/auth/auth.service';
import { getTranslocoTestingModule } from './core/i18n/transloco-testing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, getTranslocoTestingModule()],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the toolbar with a login link when logged out', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-title')?.textContent).toContain(
      'Arvid L Monorepo',
    );
    expect(compiled.textContent).toContain('Login');
  });

  // Regression: ADMIN_USERS is a multi-segment path ('admin/users'). Passed
  // as a non-first routerLink array element the router does NOT split it on
  // '/' and the link ends up at /admin%2Fusers (404).
  it('links the admin Users nav entry to /admin/users', async () => {
    TestBed.inject(AuthService).currentUser.set({
      id: 'u1',
      email: 'admin@example.org',
      role: UserRole.ADMIN,
      displayName: null,
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('a'));
    const usersLink = links.find((a) => a.textContent?.trim() === 'Users');
    expect(usersLink?.getAttribute('href')).toBe('/admin/users');
  });
});
