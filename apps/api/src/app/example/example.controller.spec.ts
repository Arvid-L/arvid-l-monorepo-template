import { Test, TestingModule } from '@nestjs/testing';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';
import {
  CreateExampleDto,
  Example,
  UpdateExampleDto,
  ExampleType,
} from '@arvid-l-monorepo-template/shared';

describe('ExampleController', () => {
  let controller: ExampleController;
  let service: ExampleService;

  const mockExample: Example = {
    id: '1',
    name: 'Test Example',
    type: ExampleType.TYPE_A,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExampleService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExampleController],
      providers: [
        {
          provide: ExampleService,
          useValue: mockExampleService,
        },
      ],
    }).compile();

    controller = module.get<ExampleController>(ExampleController);
    service = module.get<ExampleService>(ExampleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of examples', async () => {
      mockExampleService.findAll.mockResolvedValue([mockExample]);

      const result = await controller.findAll();

      expect(result).toEqual([mockExample]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single example', async () => {
      mockExampleService.findOne.mockResolvedValue(mockExample);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockExample);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('create', () => {
    it('should create a new example', async () => {
      const createDto: CreateExampleDto = {
        name: 'New Example',
        type: ExampleType.TYPE_A,
      };
      mockExampleService.create.mockResolvedValue(mockExample);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockExample);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('update', () => {
    it('should update an example', async () => {
      const updateDto: UpdateExampleDto = {
        name: 'Updated Example',
      };
      mockExampleService.update.mockResolvedValue(mockExample);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockExample);
      expect(service.update).toHaveBeenCalledWith('1', updateDto);
    });
  });

  describe('remove', () => {
    it('should remove an example', async () => {
      mockExampleService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});
