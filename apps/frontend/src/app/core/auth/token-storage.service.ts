import { Injectable } from '@angular/core';

const TOKEN_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  set token(value: string | null) {
    if (value === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, value);
    }
  }

  get isLoggedIn(): boolean {
    return this.token !== null;
  }
}
