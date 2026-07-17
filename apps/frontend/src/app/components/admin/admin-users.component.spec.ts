import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { AdminUsersComponent } from './admin-users.component';
import { AdminApiService } from '../../core/api/admin.api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { getTranslocoTestingModule } from '../../core/i18n/transloco-testing';

describe('AdminUsersComponent', () => {
  const me = {
    id: 'admin-1',
    email: 'admin@example.org',
    role: UserRole.ADMIN,
    displayName: 'Admin',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    disabledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const other = {
    ...me,
    id: 'user-2',
    email: 'user@example.org',
    role: UserRole.USER,
    displayName: null,
  };

  const getUsers = jest.fn();
  const updateStatus = jest.fn();
  const updateRole = jest.fn();

  const setup = async () => {
    getUsers.mockReturnValue(
      of({ items: [me, other], total: 2, page: 1, pageSize: 20 }),
    );
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent, getTranslocoTestingModule()],
      providers: [
        provideNoopAnimations(),
        {
          provide: AdminApiService,
          useValue: { getUsers, updateStatus, updateRole },
        },
        {
          provide: AuthService,
          useValue: { currentUser: signal(me) },
        },
        { provide: ToastService, useValue: { success: jest.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminUsersComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => jest.clearAllMocks());

  it('loads and renders the first page of users', async () => {
    const fixture = await setup();
    const el: HTMLElement = fixture.nativeElement;

    expect(getUsers).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(el.textContent).toContain('user@example.org');
    expect(el.textContent).toContain('Active');
  });

  it('hides the disable button on your own row', async () => {
    const fixture = await setup();
    const rows = fixture.nativeElement.querySelectorAll('tr[mat-row]');

    expect(rows[0].textContent).not.toContain('Disable'); // self
    expect(rows[1].textContent).toContain('Disable');
  });

  it('toggles the status of another user and reloads', async () => {
    updateStatus.mockReturnValue(of({ ...other, disabledAt: 'now' }));
    const fixture = await setup();

    fixture.componentInstance.onToggleStatus(other);

    expect(updateStatus).toHaveBeenCalledWith('user-2', true);
    expect(getUsers).toHaveBeenCalledTimes(2);
  });
});
