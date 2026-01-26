import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Example, ExampleType } from '@arvid-l-monorepo-template/shared';
import { ExampleEditDialogComponent } from './example-edit-dialog/example-edit-dialog.component';
import { ExampleApiService } from '../../core/api/example.api.service';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCardModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.scss'],
})
export class ExampleComponent {
  private fb = inject(FormBuilder);
  private exampleApiService = inject(ExampleApiService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  examples = signal<Example[]>([]);
  displayedColumns = ['name', 'type', 'createdAt', 'actions'];
  exampleTypes = Object.values(ExampleType);

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    type: [null, Validators.required],
  });

  constructor() {
    this.loadExamples();
  }

  loadExamples(): void {
    this.exampleApiService.getAll().subscribe({
      next: (examples) => {
        this.examples.set(examples);
      },
      error: () => {
        this.snackBar.open('Failed to load examples', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.exampleApiService.create(this.form.value).subscribe({
        next: () => {
          this.snackBar.open('Example created successfully', 'Close', {
            duration: 3000,
          });
          this.form.reset();
          this.loadExamples();
        },
        error: () => {
          this.snackBar.open('Failed to create example', 'Close', {
            duration: 3000,
          });
        },
      });
    }
  }

  onEdit(example: Example): void {
    const dialogRef = this.dialog.open(ExampleEditDialogComponent, {
      width: '400px',
      data: example,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadExamples();
      }
    });
  }

  onDelete(id: string): void {
    if (confirm('Are you sure you want to delete this example?')) {
      this.exampleApiService.delete(id).subscribe({
        next: () => {
          this.snackBar.open('Example deleted successfully', 'Close', {
            duration: 3000,
          });
          this.loadExamples();
        },
        error: () => {
          this.snackBar.open('Failed to delete example', 'Close', {
            duration: 3000,
          });
        },
      });
    }
  }
}
