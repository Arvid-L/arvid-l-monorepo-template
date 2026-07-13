import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../core/auth/auth.api.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthApiService: jest.Mocked<AuthApiService>;
  let router: Router;

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn().mockReturnValue(of({ message: 'Check your inbox' })),
    } as any;

    mockAuthApiService = {
      resendVerification: jest.fn().mockReturnValue(of(undefined)),
    } as any;

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthApiService, useValue: mockAuthApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the check-your-inbox state after submit, without navigating', () => {
    const navigate = jest.spyOn(router, 'navigate');
    component.form.patchValue({
      email: 'new@example.org',
      password: 'password-123',
      passwordConfirm: 'password-123',
    });

    component.onSubmit();

    expect(mockAuthService.register).toHaveBeenCalledWith({
      email: 'new@example.org',
      password: 'password-123',
    });
    expect(component.registered()).toBe(true);
    expect(component.submittedEmail()).toBe('new@example.org');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stays on the form when registration fails', () => {
    mockAuthService.register.mockReturnValue(
      throwError(() => new Error('conflict')),
    );
    component.form.patchValue({
      email: 'taken@example.org',
      password: 'password-123',
      passwordConfirm: 'password-123',
    });

    component.onSubmit();

    expect(component.registered()).toBe(false);
    expect(component.submitting()).toBe(false);
  });

  it('resend calls the API and enters cooldown', () => {
    component.submittedEmail.set('new@example.org');

    component.resend();

    expect(mockAuthApiService.resendVerification).toHaveBeenCalledWith(
      'new@example.org',
    );
    expect(component.resendCooldown()).toBe(true);
  });
});
