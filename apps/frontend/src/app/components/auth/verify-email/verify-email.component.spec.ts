import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { VerifyEmailComponent } from './verify-email.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { ToastService } from '../../../core/services/toast.service';
import { getTranslocoTestingModule } from '../../../core/i18n/transloco-testing';

describe('VerifyEmailComponent', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuthApiService: jest.Mocked<AuthApiService>;
  let mockToastService: jest.Mocked<ToastService>;
  let navigate: jest.SpyInstance;

  // The component verifies in its constructor, so the token must be in
  // place before createComponent — hence a setup helper per test.
  const setup = async (
    token: string | null,
  ): Promise<ComponentFixture<VerifyEmailComponent>> => {
    await TestBed.configureTestingModule({
      imports: [VerifyEmailComponent, getTranslocoTestingModule()],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthApiService, useValue: mockAuthApiService },
        { provide: ToastService, useValue: mockToastService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(token ? { token } : {}),
            },
          },
        },
      ],
    }).compileComponents();

    navigate = jest
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    mockAuthService = {
      verifyEmail: jest.fn().mockReturnValue(of({})),
    } as any;
    mockAuthApiService = {
      resendVerification: jest.fn().mockReturnValue(of(undefined)),
    } as any;
    mockToastService = { success: jest.fn() } as any;
  });

  it('verifies a valid token and navigates home', async () => {
    await setup('valid-token');

    expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid-token');
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows the error state when the token is missing', async () => {
    const fixture = await setup(null);

    expect(fixture.componentInstance.status()).toBe('error');
    expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();
  });

  it('shows the error state when verification fails', async () => {
    mockAuthService.verifyEmail.mockReturnValue(
      throwError(() => new Error('bad token')),
    );

    const fixture = await setup('expired-token');

    expect(fixture.componentInstance.status()).toBe('error');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('resend requests a fresh mail for the entered address', async () => {
    mockAuthService.verifyEmail.mockReturnValue(
      throwError(() => new Error('bad token')),
    );
    const fixture = await setup('expired-token');
    const component = fixture.componentInstance;

    component.resendForm.patchValue({ email: 'me@example.org' });
    component.resend();

    expect(mockAuthApiService.resendVerification).toHaveBeenCalledWith(
      'me@example.org',
    );
    expect(component.resendRequested()).toBe(true);
  });
});
