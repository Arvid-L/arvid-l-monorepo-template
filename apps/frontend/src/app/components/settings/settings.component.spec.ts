import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { AuthService } from '../../core/auth/auth.service';
import { AuthApiService } from '../../core/auth/auth.api.service';
import { ToastService } from '../../core/services/toast.service';
import { getTranslocoTestingModule } from '../../core/i18n/transloco-testing';
import { signal } from '@angular/core';

describe('SettingsComponent', () => {
  const updateProfile = jest.fn();
  const deleteAccount = jest.fn();
  const changePassword = jest.fn();
  const changeEmail = jest.fn();
  const toastSuccess = jest.fn();

  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent, getTranslocoTestingModule()],
      providers: [
        provideNoopAnimations(),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id: 'u1',
              email: 'me@example.org',
              role: 'user',
              displayName: 'Me',
            }),
            updateProfile,
            deleteAccount,
          },
        },
        {
          provide: AuthApiService,
          useValue: { changePassword, changeEmail },
        },
        { provide: ToastService, useValue: { success: toastSuccess } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => jest.clearAllMocks());

  it('prefills the profile form with the current display name', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance.profileForm.value.displayName).toBe('Me');
  });

  it('submits a password change and resets the form', async () => {
    changePassword.mockReturnValue(of({}));
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
      newPasswordConfirm: 'new-password-123',
    });
    component.changePassword();

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    });
    expect(toastSuccess).toHaveBeenCalled();
    expect(component.passwordForm.value.currentPassword).toBeNull();
  });

  it('keeps the password form invalid on mismatch', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
      newPasswordConfirm: 'different',
    });

    expect(component.passwordForm.hasError('passwordMismatch')).toBe(true);
  });

  it('shows the pending state after requesting an email change', async () => {
    changeEmail.mockReturnValue(of(undefined));
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.emailForm.setValue({
      newEmail: 'new@example.org',
      password: 'secret-password',
    });
    component.changeEmail();

    expect(changeEmail).toHaveBeenCalledWith({
      newEmail: 'new@example.org',
      password: 'secret-password',
    });
    expect(component.pendingEmail()).toBe('new@example.org');
  });

  it('asks for confirmation before deleting the account', async () => {
    deleteAccount.mockReturnValue(of(undefined));
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.deleteForm.setValue({ password: 'secret-password' });
    component.deleteAccount();

    expect(deleteAccount).not.toHaveBeenCalled();

    (window.confirm as jest.Mock).mockReturnValue(true);
    component.deleteAccount();
    expect(deleteAccount).toHaveBeenCalledWith('secret-password');
  });
});
