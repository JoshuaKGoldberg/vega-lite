

import {isAggregate} from '../../encoding';
import {field} from '../../fielddef';
import {isSortField} from '../../sort';
import {contains} from '../../util';

 import {sortParams} from '../common';
import {UnitModel} from '../unit';
import {DataFlowNode} from './dataflow';

export class OrderNode extends DataFlowNode {
  private field: string | string[];
  private order: string | string[];

  constructor(model: UnitModel) {
    super();

    if (contains(['line', 'area'], model.mark())) {
      if (model.mark() === 'line' && model.channelHasField('order')) {
        // For only line, sort by the order field if it is specified.
        const {field, order} = sortParams(model.encoding.order);
        this.field = field;
        this.order = order;
      } else {
        // For both line and area, we sort values based on dimension by default
        const dimensionChannel: 'x' | 'y' = model.markDef.orient === 'horizontal' ? 'y' : 'x';
        const sort = model.sort(dimensionChannel);
        const sortField = isSortField(sort) ?
          field({
            // FIXME: this op might not already exist?
            // FIXME: what if dimensionChannel (x or y) contains custom domain?
            aggregate: isAggregate(model.encoding) ? sort.op : undefined,
            field: sort.field
          }) :
          model.field(dimensionChannel, {binSuffix: 'start'});

        this.field = sortField;
        this.order = 'descending';
      }
    }
  }

  public assemble() {
      return {
        type: 'collect',
        sort: {
          field: this.field,
          order: this.order
        }
      };
  }
}
