import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AuthUser,
  LoginDto,
  LoginResponse,
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
