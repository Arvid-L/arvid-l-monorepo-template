import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExampleService } from './example.service';
import { DATABASE } from '../../database/database.module';
import {
  CreateExampleDto,
  UpdateExampleDto,
  ExampleType,
} from '@arvid-l-monorepo-template/shared';
import { ExampleTable } from '../../database/tables/example.table';

describe('ExampleService', () => {
  let service: ExampleService;
  let mockDb: any;

  const mockExampleTable: ExampleTable = {
    id: '1',
    name: 'Test Example',
    type: ExampleType.TYPE_A, // Adjust based on your enum
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  } as unknown as ExampleTable;

  beforeEach(async () => {
    mockDb = {
      selectFrom: jest.fn(),
      insertInto: jest.fn(),
      updateTable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExampleService,
        {
          provide: DATABASE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ExampleService>(ExampleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of examples', async () => {
      const mockQueryBuilder = {
        selectFrom: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([mockExampleTable]),
      };
      mockDb.selectFrom.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].name).toBe('Test Example');
      expect(mockDb.selectFrom).toHaveBeenCalledWith('examples');
    });

    it('should return empty array when no examples found', async () => {
      const mockQueryBuilder = {
        selectFrom: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([]),
      };
      mockDb.selectFrom.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single example', async () => {
      const mockQueryBuilder = {
        selectFrom: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(mockExampleTable),
      };
      mockDb.selectFrom.mockReturnValue(mockQueryBuilder);

      const result = await service.findOne('1');

      expect(result.id).toBe('1');
      expect(result.name).toBe('Test Example');
    });

    it('should throw NotFoundException when example not found', async () => {
      const mockQueryBuilder = {
        selectFrom: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.selectFrom.mockReturnValue(mockQueryBuilder);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new example', async () => {
      const createDto: CreateExampleDto = {
        name: 'New Example',
        type: ExampleType.TYPE_A,
      };
      const mockQueryBuilder = {
        insertInto: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returningAll: jest.fn().mockReturnThis(),
        executeTakeFirstOrThrow: jest.fn().mockResolvedValue(mockExampleTable),
      };
      mockDb.insertInto.mockReturnValue(mockQueryBuilder);

      const result = await service.create(createDto);

      expect(result.id).toBe('1');
      expect(result.name).toBe('Test Example');
      expect(mockDb.insertInto).toHaveBeenCalledWith('examples');
    });
  });

  describe('update', () => {
    it('should update an example', async () => {
      const updateDto: UpdateExampleDto = {
        name: 'Updated Example',
      };
      const updatedTable = { ...mockExampleTable, name: 'Updated Example' };
      const mockQueryBuilder = {
        updateTable: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returningAll: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(updatedTable),
      };
      mockDb.updateTable.mockReturnValue(mockQueryBuilder);

      const result = await service.update('1', updateDto);

      expect(result.name).toBe('Updated Example');
      expect(mockDb.updateTable).toHaveBeenCalledWith('examples');
    });

    it('should throw NotFoundException when example not found', async () => {
      const updateDto: UpdateExampleDto = {
        name: 'Updated Example',
      };
      const mockQueryBuilder = {
        updateTable: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returningAll: jest.fn().mockReturnThis(),
        executeTakeFirst: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.updateTable.mockReturnValue(mockQueryBuilder);

      await expect(service.update('999', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete an example', async () => {
      const mockQueryBuilder = {
        updateTable: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest
          .fn()
          .mockResolvedValue({ numUpdatedRows: BigInt(1) }),
      };
      mockDb.updateTable.mockReturnValue(mockQueryBuilder);

      await service.remove('1');

      expect(mockDb.updateTable).toHaveBeenCalledWith('examples');
    });

    it('should throw NotFoundException when example not found', async () => {
      const mockQueryBuilder = {
        updateTable: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        executeTakeFirst: jest
          .fn()
          .mockResolvedValue({ numUpdatedRows: BigInt(0) }),
      };
      mockDb.updateTable.mockReturnValue(mockQueryBuilder);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });
});
