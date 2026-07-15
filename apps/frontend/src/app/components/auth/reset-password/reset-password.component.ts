import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ROUTES } from '../../../core/constants/routes.constants';

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('passwordConfirm')?.value
    ? null
    : { passwordMismatch: true };

// Landing page for the link in the password reset mail:
// /reset-password?token=<opaque token>
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../auth-page.scss'],
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly ROUTES = ROUTES;
  readonly submitting = signal(false);
  readonly token: string | null =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token');

  form: FormGroup = this.fb.group(
    {
      // Mirrors the API's MinLength(8) on ResetPasswordDto
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  onSubmit(): void {
    if (!this.form.valid || !this.token) {
      return;
    }
    this.submitting.set(true);
    this.authApi
      .resetPassword({ token: this.token, password: this.form.value.password })
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('auth.reset.changed'));
          this.router.navigate(['/', ROUTES.LOGIN]);
        },
        // errors surface via the global httpErrorInterceptor toast
        error: () => this.submitting.set(false),
      });
  }
}
