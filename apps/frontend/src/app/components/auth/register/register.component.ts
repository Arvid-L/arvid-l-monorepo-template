import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
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
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['../auth-page.scss'],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly ROUTES = ROUTES;
  readonly submitting = signal(false);

  form: FormGroup = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      // Mirrors the API's MinLength(8) on RegisterDto
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  onSubmit(): void {
    if (!this.form.valid) {
      return;
    }
    this.submitting.set(true);
    const { email, password } = this.form.value;
    this.auth.register({ email, password }).subscribe({
      next: () => this.router.navigate(['/']),
      // errors surface via the global httpErrorInterceptor toast
      error: () => this.submitting.set(false),
    });
  }
}
