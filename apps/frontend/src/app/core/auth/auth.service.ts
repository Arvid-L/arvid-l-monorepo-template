import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthUser,
  LoginDto,
  RegisterDto,
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

  register(data: RegisterDto): Observable<unknown> {
    return this.authApi
      .register(data)
      .pipe(tap((response) => this.currentUser.set(response.user)));
  }

  logout(): void {
    this.currentUser.set(null);
    // Server-side revocation is best-effort — local state is already gone.
    this.authApi.logout().subscribe({ error: () => undefined });
    this.router.navigate([ROUTES.LOGIN]);
  }
}
