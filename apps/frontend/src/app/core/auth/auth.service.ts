import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthUser,
  LoginDto,
  RegisterDto,
  RegisterResponse,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { Observable, tap } from 'rxjs';
import { ROUTES } from '../constants/routes.constants';
import { AuthApiService } from './auth.api.service';
import { TokenStorageService } from './token-storage.service';

// Client-side auth state: the single source of truth for "who is logged
// in". Components read the signals; login/register/logout go through here
// (not AuthApiService directly) so the state stays consistent.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(
    () => this.currentUser()?.role === UserRole.ADMIN,
  );

  constructor() {
    // Restore the session after a page reload: tokens survive in storage,
    // the user object doesn't. A dead session 401s → interceptor tries a
    // refresh → if that fails too, storage is cleared and user stays null.
    if (this.tokenStorage.isLoggedIn) {
      this.authApi.me().subscribe({
        next: (user) => this.currentUser.set(user),
        error: () => this.tokenStorage.clear(),
      });
    }
  }

  login(credentials: LoginDto): Observable<unknown> {
    return this.authApi
      .login(credentials)
      .pipe(tap((response) => this.currentUser.set(response.user)));
  }

  // Registration no longer returns a session — the user must click the
  // verification link first (hard gate, see API AuthService.register).
  register(data: RegisterDto): Observable<RegisterResponse> {
    return this.authApi.register(data);
  }

  verifyEmail(token: string): Observable<unknown> {
    return this.authApi
      .verifyEmail(token)
      .pipe(tap((response) => this.currentUser.set(response.user)));
  }

  logout(): void {
    this.currentUser.set(null);
    // Server-side revocation is best-effort — local state is already gone.
    this.authApi.logout().subscribe({ error: () => undefined });
    this.router.navigate([ROUTES.LOGIN]);
  }

  updateProfile(displayName: string): Observable<AuthUser> {
    return this.authApi
      .updateProfile({ displayName })
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  deleteAccount(password: string): Observable<void> {
    return this.authApi.deleteAccount({ password }).pipe(
      tap(() => {
        // The account is gone — drop all local state, no server logout
        // (the tokens died with the user row).
        this.currentUser.set(null);
        this.tokenStorage.clear();
        this.router.navigate(['/']);
      }),
    );
  }
}
