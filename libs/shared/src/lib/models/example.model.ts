import { ExampleType } from '../enums';
import { Base } from './base.model';

export interface Example extends Base {
  type: ExampleType;
  name: string;
}
