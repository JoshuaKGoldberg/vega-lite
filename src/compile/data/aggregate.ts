
import {field, FieldDef} from '../../fielddef';
import {Dict, keys, StringSet} from '../../util';
import {VgAggregateTransform} from '../../vega.schema';
import {Model} from './../model';
import {DataFlowNode} from './dataflow';

function addDimension(dims: {[field: string]: boolean}, fieldDef: FieldDef) {
  if (fieldDef.bin) {
    dims[field(fieldDef, {binSuffix: 'start'})] = true;
    dims[field(fieldDef, {binSuffix: 'end'})] = true;

    // const scale = model.scale(channel);
    // if (scaleType(scale, fieldDef, channel, model.mark()) === ScaleType.ORDINAL) {
    // also produce bin_range if the binned field use ordinal scale
    dims[field(fieldDef, {binSuffix: 'range'})] = true;
    // }
  } else {
    dims[field(fieldDef)] = true;
  }
  return dims;
}

function mergeMeasures(parentMeasures: Dict<Dict<boolean>>, childMeasures: Dict<Dict<boolean>>) {
  for (const field in childMeasures) {
    if (childMeasures.hasOwnProperty(field)) {
      // when we merge a measure, we either have to add an aggregation operator or even a new field
      const ops = childMeasures[field];
      for (const op in ops) {
        if (ops.hasOwnProperty(op)) {
          if (field in parentMeasures) {
            // add operator to existing measure field
            parentMeasures[field][op] = true;
          } else {
            parentMeasures[field] = {op: true};
          }
        }
      }
    }
  }
}

export class AggregateNode extends DataFlowNode {
  /** string set for dimensions */
  private dimensions: StringSet;

  /** dictionary mapping field name => dict set of aggregation functions */
  private measures: Dict<StringSet>;

  constructor(model: Model) {
    super();

    const meas = this.measures = {};
    const dims = this.dimensions = {};

    model.forEachFieldDef(function(fieldDef, channel) {
      if (fieldDef.aggregate) {
        if (fieldDef.aggregate === 'count') {
          meas['*'] = meas['*'] || {};
          /* tslint:disable:no-string-literal */
          meas['*']['count'] = true;
          /* tslint:enable:no-string-literal */
        } else {
          meas[fieldDef.field] = meas[fieldDef.field] || {};
          meas[fieldDef.field][fieldDef.aggregate] = true;

          // add min/max so we can use their union as unaggregated domain
          const scale = model.scale(channel);
          if (scale && scale.domain === 'unaggregated') {
            meas[fieldDef.field]['min'] = true;
            meas[fieldDef.field]['max'] = true;
          }
        }
      } else {
        addDimension(dims, fieldDef);
      };
    });
  }

  public size() {
    return Object.keys(this.dimensions).length;
  }

  public assemble(): VgAggregateTransform {
    let ops: string[] = [];
    let fields: string[] = [];
    keys(this.measures).forEach(field => {
      keys(this.measures[field]).forEach(op => {
        ops.push(op);
        fields.push(field);
      });
    });

    return {
      type: 'aggregate',
      groupby: keys(this.dimensions),
      ops,
      fields
    };
  };
}
