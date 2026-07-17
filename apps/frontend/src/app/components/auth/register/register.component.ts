import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { ROUTES } from '../../../core/constants/routes.constants';

// Cross-field validator: passwordConfirm must match password.
const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('passwordConfirm')?.value
    ? null
    : { passwordMismatch: true };

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['../auth-page.scss'],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);

  readonly ROUTES = ROUTES;
  readonly submitting = signal(false);
  readonly registered = signal(false);
  readonly resendCooldown = signal(false);
  readonly submittedEmail = signal('');

  form: FormGroup = this.fb.group(
    {
      displayName: ['', Validators.maxLength(120)],
      email: ['', [Validators.required, Validators.email]],
      // Mirrors the API's MinLength(8) on RegisterDto
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', Validators.required],
      // Mirrors the API's Equals(true) — GDPR consent is mandatory.
      privacyAccepted: [false, Validators.requiredTrue],
    },
    { validators: passwordsMatch },
  );

  onSubmit(): void {
    if (!this.form.valid) {
      return;
    }
    this.submitting.set(true);
    const { email, password, displayName, privacyAccepted } = this.form.value;
    this.auth
      .register({
        email,
        password,
        displayName: displayName || undefined,
        privacyAccepted,
      })
      .subscribe({
        next: () => {
          this.submittedEmail.set(email);
          this.registered.set(true);
        },
        // errors surface via the global httpErrorInterceptor toast
        error: () => this.submitting.set(false),
      });
  }

  resend(): void {
    this.resendCooldown.set(true);
    this.authApi.resendVerification(this.submittedEmail()).subscribe();
    // Matches the API's 60 s reissue limit — button wakes up when a new
    // token could actually be issued.
    setTimeout(() => this.resendCooldown.set(false), 60_000);
  }
}
