import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AdminUser,
  PageRequest,
  PageResponse,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  readonly http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/auth/users`;

  getUsers(
    request: Partial<PageRequest> = {},
  ): Observable<PageResponse<AdminUser>> {
    let params = new HttpParams()
      .set('page', request.page ?? 1)
      .set('pageSize', request.pageSize ?? 20);
    if (request.sort) {
      params = params.set('sort', request.sort);
    }
    if (request.order) {
      params = params.set('order', request.order);
    }
    return this.http.get<PageResponse<AdminUser>>(this.apiUrl, { params });
  }

  updateRole(id: string, role: UserRole): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${id}/role`, { role });
  }

  updateStatus(id: string, disabled: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${id}/status`, {
      disabled,
    });
  }
}
