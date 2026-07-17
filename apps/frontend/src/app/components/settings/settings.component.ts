import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { AuthApiService } from '../../core/auth/auth.api.service';
import { ToastService } from '../../core/services/toast.service';

// Cross-field validator: newPasswordConfirm must match newPassword.
const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('newPassword')?.value === group.get('newPasswordConfirm')?.value
    ? null
    : { passwordMismatch: true };

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './settings.component.html',
  styles: `
    .settings-page {
      max-width: 32rem;
      margin: 2rem auto;
      padding: 0 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .danger-title {
      color: var(--mat-sys-error, #b3261e);
    }
  `,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly savingProfile = signal(false);
  readonly changingPassword = signal(false);
  readonly changingEmail = signal(false);
  readonly deleting = signal(false);
  // Set once a change-email verification mail went out.
  readonly pendingEmail = signal<string | null>(null);

  profileForm: FormGroup = this.fb.group({
    displayName: [
      this.auth.currentUser()?.displayName ?? '',
      Validators.maxLength(120),
    ],
  });

  passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      newPasswordConfirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  emailForm: FormGroup = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  deleteForm: FormGroup = this.fb.group({
    password: ['', Validators.required],
  });

  saveProfile(): void {
    if (!this.profileForm.valid) {
      return;
    }
    this.savingProfile.set(true);
    this.auth.updateProfile(this.profileForm.value.displayName).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.success(this.transloco.translate('settings.profile.saved'));
      },
      // errors surface via the global httpErrorInterceptor toast
      error: () => this.savingProfile.set(false),
    });
  }

  changePassword(): void {
    if (!this.passwordForm.valid) {
      return;
    }
    this.changingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.authApi.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.toast.success(
          this.transloco.translate('settings.password.changed'),
        );
      },
      error: () => this.changingPassword.set(false),
    });
  }

  changeEmail(): void {
    if (!this.emailForm.valid) {
      return;
    }
    this.changingEmail.set(true);
    const { newEmail, password } = this.emailForm.value;
    this.authApi.changeEmail({ newEmail, password }).subscribe({
      next: () => {
        this.changingEmail.set(false);
        this.pendingEmail.set(newEmail);
        this.emailForm.reset();
      },
      error: () => this.changingEmail.set(false),
    });
  }

  deleteAccount(): void {
    if (!this.deleteForm.valid) {
      return;
    }
    if (!confirm(this.transloco.translate('settings.danger.confirm'))) {
      return;
    }
    this.deleting.set(true);
    this.auth.deleteAccount(this.deleteForm.value.password).subscribe({
      next: () =>
        this.toast.success(this.transloco.translate('settings.danger.deleted')),
      error: () => this.deleting.set(false),
    });
  }
}
