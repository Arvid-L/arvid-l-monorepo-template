import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AuthUser,
  ForgotPasswordDto,
  LoginDto,
  LoginResponse,
  RegisterDto,
  RegisterResponse,
  ResetPasswordDto,
} from '@arvid-l-monorepo-template/shared';
import { finalize, Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);

  private apiUrl = `${environment.apiUrl}/auth`;

  // Refresh tokens rotate server-side: a second concurrent refresh would use
  // an already-revoked token and log the user out. Single-flight ensures all
  // parallel 401 retries share one refresh request.
  private refreshInFlight$: Observable<LoginResponse> | null = null;

  login(credentials: LoginDto): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(tap((response) => this.storeTokens(response)));
  }

  // Registration no longer returns tokens — the account must be verified
  // via the mailed link first.
  register(data: RegisterDto): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, data);
  }

  verifyEmail(token: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/verify-email`, { token })
      .pipe(tap((response) => this.storeTokens(response)));
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/resend-verification`, {
      email,
    });
  }

  forgotPassword(data: ForgotPasswordDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot-password`, data);
  }

  resetPassword(data: ResetPasswordDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, data);
  }

  refresh(): Observable<LoginResponse> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http
        .post<LoginResponse>(`${this.apiUrl}/refresh`, {
          refreshToken: this.tokenStorage.refreshToken,
        })
        .pipe(
          tap((response) => this.storeTokens(response)),
          finalize(() => (this.refreshInFlight$ = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refreshInFlight$;
  }

  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.apiUrl}/me`);
  }

  logout(): Observable<void> {
    const refreshToken = this.tokenStorage.refreshToken;
    this.tokenStorage.clear();
    return this.http.post<void>(`${this.apiUrl}/logout`, { refreshToken });
  }

  private storeTokens(response: LoginResponse): void {
    this.tokenStorage.store(response.accessToken, response.refreshToken);
  }
}
