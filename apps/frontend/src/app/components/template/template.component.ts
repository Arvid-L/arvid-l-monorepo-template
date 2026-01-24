import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ApiResponse } from '@arvid-l-monorepo-template/shared';

type TemplateData = { message: string };

@Component({
  selector: 'app-template',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './template.component.html',
  styleUrl: './template.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateComponent implements OnInit {
  readonly httpClient = inject(HttpClient);

  protected title = 'templateTitle';
  readonly apiResponse = signal<ApiResponse<TemplateData> | null>(null);

  ngOnInit(): void {
    this.httpClient
      .get<ApiResponse<TemplateData>>('http://localhost:3000')
      .subscribe((response) => {
        this.apiResponse.set(response);
      });
  }
}
