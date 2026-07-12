import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Insertable, Kysely, Selectable, Updateable } from 'kysely';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import {
  CreateExampleDto,
  Example,
  UpdateExampleDto,
} from '@arvid-l-monorepo-template/shared';
import { ExampleTable } from '../../database/tables/example.table';

@Injectable()
export class ExampleService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  private tableToModel(example: Selectable<ExampleTable>): Example {
    return {
      id: example.id,
      name: example.name,
      type: example.type,
      createdAt: new Date(example.created_at),
      updatedAt: new Date(example.updated_at),
      deletedAt: example.deleted_at ? new Date(example.deleted_at) : null,
    };
  }

  private dtoToInsertable(example: CreateExampleDto): Insertable<ExampleTable> {
    return {
      name: example.name,
      type: example.type,
    };
  }

  private dtoToUpdatable(example: UpdateExampleDto): Updateable<ExampleTable> {
    return {
      name: example.name,
      type: example.type,
    };
  }

  async findAll(): Promise<Example[]> {
    const examples = await this.db
      .selectFrom('examples')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute();

    return examples.map(this.tableToModel);
  }

  async findOne(id: string): Promise<Example> {
    const example = await this.db
      .selectFrom('examples')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!example) {
      throw new NotFoundException(`Example with ID ${id} not found`);
    }

    return this.tableToModel(example);
  }

  async create(createDto: CreateExampleDto): Promise<Example> {
    const example = await this.db
      .insertInto('examples')
      .values(this.dtoToInsertable(createDto))
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.tableToModel(example);
  }

  async update(id: string, updateDto: UpdateExampleDto): Promise<Example> {
    const example = await this.db
      .updateTable('examples')
      .set(this.dtoToUpdatable(updateDto))
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!example) {
      throw new NotFoundException(`Example with ID ${id} not found`);
    }

    return this.tableToModel(example);
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .updateTable('examples')
      .set({ deleted_at: new Date().toISOString() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundException(`Example with ID ${id} not found`);
    }
  }
}
