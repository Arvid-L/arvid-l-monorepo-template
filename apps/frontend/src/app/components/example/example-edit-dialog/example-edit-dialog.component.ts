import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Example, ExampleType } from '@arvid-l-monorepo-template/shared';
import { ExampleApiService } from '../../../core/api/example.api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-example-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './example-edit-dialog.component.html',
  styleUrl: './example-edit-dialog.component.scss',
})
export class ExampleEditDialogComponent {
  private fb = inject(FormBuilder);
  private exampleApiService = inject(ExampleApiService);
  private toast = inject(ToastService);
  private dialogRef = inject(MatDialogRef<ExampleEditDialogComponent>);

  public data = inject<Example>(MAT_DIALOG_DATA);

  exampleTypes = Object.values(ExampleType);

  form: FormGroup = this.fb.group({
    name: [this.data.name, Validators.required],
    type: [this.data.type, Validators.required],
  });

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSave(): void {
    if (this.form.valid) {
      this.exampleApiService.update(this.data.id, this.form.value).subscribe({
        next: () => {
          this.toast.success('Example updated successfully');
          this.dialogRef.close(true);
        },
        // errors surface via the global httpErrorInterceptor toast
        error: () => undefined,
      });
    }
  }
}
