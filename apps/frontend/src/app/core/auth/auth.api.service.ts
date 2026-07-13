import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AuthUser,
  LoginDto,
  LoginResponse,
} from '@arvid-l-monorepo-template/shared';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);

  private apiUrl = `${environment.apiUrl}/auth`;

  login(credentials: LoginDto): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap((response) => (this.tokenStorage.token = response.accessToken)),
      );
  }

  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.apiUrl}/me`);
  }

  logout(): void {
    this.tokenStorage.token = null;
  }
}
