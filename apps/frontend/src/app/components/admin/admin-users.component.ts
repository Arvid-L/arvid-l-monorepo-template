import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AdminUser, UserRole } from '@arvid-l-monorepo-template/shared';
import { AdminApiService } from '../../core/api/admin.api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    TranslocoPipe,
  ],
  templateUrl: './admin-users.component.html',
  styles: `
    .admin-users-page {
      max-width: 64rem;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .users-table {
      width: 100%;
    }
    .role-select {
      width: 8.5rem;
    }
  `,
})
export class AdminUsersComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  readonly auth = inject(AuthService);

  readonly users = signal<AdminUser[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly displayedColumns = [
    'displayName',
    'email',
    'role',
    'verified',
    'status',
    'createdAt',
    'actions',
  ];
  readonly roles = Object.values(UserRole);

  constructor() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.adminApi
      .getUsers({ page: this.pageIndex() + 1, pageSize: this.pageSize() })
      .subscribe({
        next: (page) => {
          this.users.set(page.items);
          this.total.set(page.total);
        },
        // errors surface via the global httpErrorInterceptor toast
        error: () => undefined,
      });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadUsers();
  }

  isSelf(user: AdminUser): boolean {
    return user.id === this.auth.currentUser()?.id;
  }

  onRoleChange(user: AdminUser, role: UserRole): void {
    this.adminApi.updateRole(user.id, role).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('admin.users.roleChanged'));
        this.loadUsers();
      },
      // reload puts the real server state back after a failed change
      error: () => this.loadUsers(),
    });
  }

  onToggleStatus(user: AdminUser): void {
    this.adminApi.updateStatus(user.id, !user.disabledAt).subscribe({
      next: () => {
        this.toast.success(
          this.transloco.translate('admin.users.statusChanged'),
        );
        this.loadUsers();
      },
      error: () => this.loadUsers(),
    });
  }
}
