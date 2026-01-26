import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExampleEditDialogComponent } from './example-edit-dialog.component';
import { ExampleApiService } from '../../../core/api/example.api.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { Example, ExampleType } from '@arvid-l-monorepo-template/shared';

describe('ExampleEditDialogComponent', () => {
  let component: ExampleEditDialogComponent;
  let fixture: ComponentFixture<ExampleEditDialogComponent>;
  let mockExampleApiService: jest.Mocked<ExampleApiService>;
  let mockDialogRef: jest.Mocked<MatDialogRef<ExampleEditDialogComponent>>;

  const mockData: Example = {
    id: '1',
    name: 'Test Example',
    type: ExampleType.TYPE_A,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockExampleApiService = {
      update: jest.fn().mockReturnValue(of(mockData)),
    } as any;

    mockDialogRef = {
      close: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ExampleEditDialogComponent],
      providers: [
        { provide: ExampleApiService, useValue: mockExampleApiService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with dialog data', () => {
    expect(component.form.value).toEqual({
      name: mockData.name,
      type: mockData.type,
    });
  });

  it('should have valid form with initial data', () => {
    expect(component.form.valid).toBeTruthy();
  });

  it('should have invalid form when name is empty', () => {
    component.form.patchValue({ name: '' });
    expect(component.form.valid).toBeFalsy();
  });

  it('should have invalid form when type is empty', () => {
    component.form.patchValue({ type: null });
    expect(component.form.valid).toBeFalsy();
  });

  it('should close dialog with false when cancel is clicked', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });

  it('should call update API when form is valid', () => {
    component.form.patchValue({
      name: 'Updated Name',
      type: ExampleType.TYPE_B,
    });

    component.onSave();

    expect(mockExampleApiService.update).toHaveBeenCalledWith('1', {
      name: 'Updated Name',
      type: ExampleType.TYPE_B,
    });
  });

  it('should not call update API when form is invalid', () => {
    component.form.patchValue({ name: '' });

    component.onSave();

    expect(mockExampleApiService.update).not.toHaveBeenCalled();
  });

  it('should handle update API errors', () => {
    mockExampleApiService.update.mockReturnValue(
      throwError(() => new Error('Failed')),
    );

    component.onSave();

    expect(mockExampleApiService.update).toHaveBeenCalled();
  });

  it('should have all example types available', () => {
    expect(component.exampleTypes).toEqual(Object.values(ExampleType));
  });
});
