import {COLUMN, ROW} from '../../channel';
import { VgData, VgTransform } from '../../vega.schema';
import {FacetModel} from '../facet';
import { DataFlowNode, OutputNode } from './dataflow';

/**
 * A node that helps us track what fields we are faceting by.
 */
export class FacetNode extends DataFlowNode {
  public readonly fields: string[];

  public source: string;

  public readonly name: string;

  public constructor(model: FacetModel) {
    super();

    this.fields = [];

    if (model.facet.column) {
      this.fields.push(model.field(COLUMN));
    }

    if (model.facet.row) {
      this.fields.push(model.field(ROW));
    }

    this.name = model.getName('facet');
  }
}

/**
 * Add aggregation that we need to create correct axes for faceted charts.
 *
 * This is a special output node that is always required when instantiated.
 */
export class FacetAggregateNode extends OutputNode {
  private readonly field: string;
  public readonly name: string;

  public constructor(model: FacetModel, field: 'column' | 'row') {
    super(field);

    this.markRequired();

    if (!model.facet[field]) {
      throw new Error('Unnecessary data output.');
    }

    switch (field) {
      case 'column':
      this.field = model.field(COLUMN);
      this.name = model.getName('column', '-');
      break;
    case 'row':
      this.field = model.field(ROW);
      this.name = model.getName('row', '-');
      break;
    }
  }

  public assemble(): VgTransform {
    return {
      type: 'aggregate',
      groupby: [this.field]
    };
  }
}
