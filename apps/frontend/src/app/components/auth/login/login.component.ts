import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ErrorCode } from '@arvid-l-monorepo-template/shared';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { ROUTES } from '../../../core/constants/routes.constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['../auth-page.scss'],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly ROUTES = ROUTES;
  readonly submitting = signal(false);
  readonly unverifiedEmail = signal<string | null>(null);
  readonly resendRequested = signal(false);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  onSubmit(): void {
    if (!this.form.valid) {
      return;
    }
    this.submitting.set(true);
    this.auth.login(this.form.value).subscribe({
      next: () => {
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        // 403 EMAIL_NOT_VERIFIED gets its own UI (resend link) instead of
        // only the generic toast from httpErrorInterceptor.
        this.unverifiedEmail.set(
          err.error?.errorCode === ErrorCode.EMAIL_NOT_VERIFIED
            ? this.form.value.email
            : null,
        );
      },
    });
  }

  resendVerification(): void {
    const email = this.unverifiedEmail();
    if (!email) {
      return;
    }
    this.authApi
      .resendVerification(email)
      .subscribe(() => this.resendRequested.set(true));
  }
}
