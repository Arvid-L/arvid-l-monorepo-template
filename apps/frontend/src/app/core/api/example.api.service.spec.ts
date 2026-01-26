import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ExampleApiService } from './example.api.service';
import {
  Example,
  ExampleType,
  CreateExampleDto,
  UpdateExampleDto,
} from '@arvid-l-monorepo-template/shared';
import { environment } from '../../environments/environment';

describe('ExampleApiService', () => {
  let service: ExampleApiService;
  let httpMock: HttpTestingController;

  const mockExample: Example = {
    id: '1',
    name: 'Test',
    type: ExampleType.TYPE_A,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExampleApiService, provideHttpClientTesting()],
    });
    service = TestBed.inject(ExampleApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensures no outstanding HTTP requests
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get all examples', () => {
    service.getAll().subscribe((examples) => {
      expect(examples).toEqual([mockExample]);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/examples`);
    expect(req.request.method).toBe('GET');
    req.flush([mockExample]);
  });

  it('should get one example', () => {
    service.getOne('1').subscribe((example) => {
      expect(example).toEqual(mockExample);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/examples/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockExample);
  });

  it('should create example', () => {
    const createDto: CreateExampleDto = {
      name: 'Test',
      type: ExampleType.TYPE_A,
    };

    service.create(createDto).subscribe((example) => {
      expect(example).toEqual(mockExample);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/examples`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createDto);
    req.flush(mockExample);
  });

  it('should update example', () => {
    const updateDto: UpdateExampleDto = { name: 'Updated' };

    service.update('1', updateDto).subscribe((example) => {
      expect(example).toEqual(mockExample);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/examples/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updateDto);
    req.flush(mockExample);
  });

  it('should delete example', () => {
    service.delete('1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/examples/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
