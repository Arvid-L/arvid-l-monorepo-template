import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Insertable, Kysely, Selectable, Updateable, sql } from 'kysely';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import {
  CreateExampleDto,
  Example,
  PageRequest,
  PageResponse,
  UpdateExampleDto,
} from '@arvid-l-monorepo-template/shared';
import { ExampleTable } from '../../database/tables/example.table';
import {
  pageOffset,
  resolveSort,
  toPageResponse,
} from '../../common/pagination/pagination.util';

// Sortable columns for GET /examples — camelCase key as the client sends
// it, snake_case value as the DB knows it.
const EXAMPLE_SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  type: 'type',
  createdAt: 'created_at',
};

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

  async findAll(query: PageRequest): Promise<PageResponse<Example>> {
    const sortColumn = resolveSort(
      EXAMPLE_SORT_COLUMNS,
      query.sort,
      'created_at',
    );
    const order = query.order ?? 'desc';

    const [rows, countRow] = await Promise.all([
      this.db
        .selectFrom('examples')
        .selectAll()
        .where('deleted_at', 'is', null)
        .orderBy(sql.ref(sortColumn), order)
        .limit(query.pageSize)
        .offset(pageOffset(query))
        .execute(),
      this.db
        .selectFrom('examples')
        .select(({ fn }) => fn.countAll<string>().as('total'))
        .where('deleted_at', 'is', null)
        .executeTakeFirstOrThrow(),
    ]);

    return toPageResponse(
      rows.map(this.tableToModel),
      Number(countRow.total),
      query,
    );
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
