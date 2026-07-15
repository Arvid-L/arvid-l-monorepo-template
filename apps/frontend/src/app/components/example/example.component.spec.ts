import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExampleComponent } from './example.component';
import { ExampleApiService } from '../../core/api/example.api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { Example, ExampleType } from '@arvid-l-monorepo-template/shared';
import { getTranslocoTestingModule } from '../../core/i18n/transloco-testing';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;
  let mockExampleApiService: jest.Mocked<ExampleApiService>;
  let mockSnackBar: jest.Mocked<MatSnackBar>;

  const mockExamples: Example[] = [
    {
      id: '1',
      name: 'Test Example',
      type: ExampleType.TYPE_A,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    mockExampleApiService = {
      getAll: jest.fn().mockReturnValue(of(mockExamples)),
      create: jest.fn().mockReturnValue(of(mockExamples[0])),
      delete: jest.fn().mockReturnValue(of(undefined)),
    } as any;

    mockSnackBar = {
      open: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ExampleComponent, getTranslocoTestingModule()],
      providers: [
        { provide: ExampleApiService, useValue: mockExampleApiService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load examples on init', () => {
    expect(mockExampleApiService.getAll).toHaveBeenCalled();
    expect(component.examples()).toEqual(mockExamples);
  });

  it('should have invalid form when empty', () => {
    expect(component.form.valid).toBeFalsy();
  });

  it('should have valid form when filled', () => {
    component.form.patchValue({
      name: 'Test',
      type: ExampleType.TYPE_A,
    });
    expect(component.form.valid).toBeTruthy();
  });

  it('should call create API when form is submitted', () => {
    component.form.patchValue({
      name: 'New Example',
      type: ExampleType.TYPE_A,
    });

    component.onSubmit();

    expect(mockExampleApiService.create).toHaveBeenCalledWith({
      name: 'New Example',
      type: ExampleType.TYPE_A,
    });
  });

  it('should not call create API when form is invalid', () => {
    component.onSubmit();

    expect(mockExampleApiService.create).not.toHaveBeenCalled();
  });

  it('should handle create API errors', () => {
    mockExampleApiService.create.mockReturnValue(
      throwError(() => new Error('Failed')),
    );
    component.form.patchValue({
      name: 'Test',
      type: ExampleType.TYPE_A,
    });

    component.onSubmit();

    expect(mockExampleApiService.create).toHaveBeenCalled();
  });

  it('should call delete API when confirmed', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    component.onDelete('1');

    expect(mockExampleApiService.delete).toHaveBeenCalledWith('1');
  });

  it('should not call delete API when cancelled', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    component.onDelete('1');

    expect(mockExampleApiService.delete).not.toHaveBeenCalled();
  });
});
