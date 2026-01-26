import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateExampleDto,
  Example,
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

  getAll(): Observable<Example[]> {
    return this.http.get<Example[]>(this.apiUrl);
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
