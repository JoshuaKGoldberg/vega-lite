import {COLUMN, ROW} from '../../channel';
import {VgData} from '../../vega.schema';
import {COLUMN_AXES_DATA_PREFIX, FacetModel, ROW_AXES_DATA_PREFIX} from '../facet';
import {DataFlowNode} from './dataflow';

export class FacetNode extends DataFlowNode {
  private readonly prefix: string;
  private readonly field: string;
  // facet is special in that the name will never change so we can set it right away.
  public readonly name: string;
  private _source: string;

  public constructor(model: FacetModel) {
    super();

    if (model.facet.column) {
      this.prefix = COLUMN_AXES_DATA_PREFIX;
      this.field = model.field(COLUMN);
    } else if (model.facet.row) {
      this.prefix = ROW_AXES_DATA_PREFIX;
      this.field = model.field(ROW);
    }
  }

  set source(source: string) {
    this._source = source;
  }

  public assemble(): VgData {
    return {
      name: this.prefix + this._source,
      source: this._source,
      transform: [{
        type: 'aggregate',
        groupby: [this.field]
      }]
    };
  }
}
