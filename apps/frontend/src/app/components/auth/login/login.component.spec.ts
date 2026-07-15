import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { getTranslocoTestingModule } from '../../../core/i18n/transloco-testing';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthApiService: jest.Mocked<AuthApiService>;

  beforeEach(async () => {
    mockAuthService = {
      login: jest.fn().mockReturnValue(of({})),
    } as any;

    mockAuthApiService = {
      resendVerification: jest.fn().mockReturnValue(of(undefined)),
    } as any;

    await TestBed.configureTestingModule({
      imports: [LoginComponent, getTranslocoTestingModule()],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthApiService, useValue: mockAuthApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const submit = (): void => {
    component.form.patchValue({
      email: 'user@example.org',
      password: 'secret-password',
    });
    component.onSubmit();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers resend when login fails with 403 EMAIL_NOT_VERIFIED', () => {
    mockAuthService.login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { errorCode: 'EMAIL_NOT_VERIFIED' },
          }),
      ),
    );

    submit();

    expect(component.unverifiedEmail()).toBe('user@example.org');
    expect(component.submitting()).toBe(false);
  });

  it('keeps the unverified hint hidden on plain 401s', () => {
    mockAuthService.login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { errorCode: 'UNAUTHORIZED' },
          }),
      ),
    );

    submit();

    expect(component.unverifiedEmail()).toBeNull();
  });

  it('resendVerification calls the API for the unverified email', () => {
    component.unverifiedEmail.set('user@example.org');

    component.resendVerification();

    expect(mockAuthApiService.resendVerification).toHaveBeenCalledWith(
      'user@example.org',
    );
    expect(component.resendRequested()).toBe(true);
  });
});
