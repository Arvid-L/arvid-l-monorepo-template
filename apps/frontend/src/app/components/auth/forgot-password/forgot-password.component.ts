import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { ROUTES } from '../../../core/constants/routes.constants';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../auth-page.scss'],
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);

  readonly ROUTES = ROUTES;
  readonly submitting = signal(false);
  // The API always answers 204 (no account enumeration), so the only honest
  // UI is a generic "check your inbox" — shown after any submission.
  readonly sent = signal(false);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (!this.form.valid) {
      return;
    }
    this.submitting.set(true);
    this.authApi.forgotPassword(this.form.value).subscribe({
      next: () => this.sent.set(true),
      // errors surface via the global httpErrorInterceptor toast
      error: () => this.submitting.set(false),
    });
  }
}
