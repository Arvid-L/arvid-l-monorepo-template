import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateExampleDto,
  Example,
  PageRequest,
  PageResponse,
  UpdateExampleDto,
} from '@arvid-l-monorepo-template/shared';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ExampleApiService {
  readonly http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/examples`;

  getAll(
    request: Partial<PageRequest> = {},
  ): Observable<PageResponse<Example>> {
    let params = new HttpParams()
      .set('page', request.page ?? 1)
      .set('pageSize', request.pageSize ?? 10);
    if (request.sort) {
      params = params.set('sort', request.sort);
    }
    if (request.order) {
      params = params.set('order', request.order);
    }
    return this.http.get<PageResponse<Example>>(this.apiUrl, { params });
  }

  getOne(id: string): Observable<Example> {
    return this.http.get<Example>(`${this.apiUrl}/${id}`);
  }

  create(data: CreateExampleDto): Observable<Example> {
    return this.http.post<Example>(this.apiUrl, data);
  }

  update(id: string, data: UpdateExampleDto): Observable<Example> {
    return this.http.patch<Example>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
