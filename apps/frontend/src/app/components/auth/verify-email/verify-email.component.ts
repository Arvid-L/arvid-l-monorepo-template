import { Component, inject, signal } from '@angular/core';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ROUTES } from '../../../core/constants/routes.constants';

// Landing page for the link in the verification mail:
// /verify-email?token=<opaque token>
@Component({
  selector: 'app-verify-email',
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
  templateUrl: './verify-email.component.html',
  styleUrls: ['../auth-page.scss'],
})
export class VerifyEmailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly ROUTES = ROUTES;
  readonly status = signal<'verifying' | 'error'>('verifying');
  readonly resendRequested = signal(false);

  // For the error state: let the user request a fresh link.
  resendForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
    if (!token) {
      this.status.set('error');
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.toast.success('Email verified — welcome!');
        this.router.navigate(['/']);
      },
      // errors also surface via the global httpErrorInterceptor toast
      error: () => this.status.set('error'),
    });
  }

  resend(): void {
    if (!this.resendForm.valid) {
      return;
    }
    this.authApi
      .resendVerification(this.resendForm.value.email)
      .subscribe(() => this.resendRequested.set(true));
  }
}
