import { autoMaxBins, Bin, binToString } from '../../bin';
import {Channel} from '../../channel';
import {field, FieldDef} from '../../fielddef';
import {hasDiscreteDomain} from '../../scale';
import {Dict, extend, flatten, hash, isBoolean, vals, varName} from '../../util';
import {VgBinTransform, VgTransform} from '../../vega.schema';
import {Model} from './../model';
import {DataFlowNode} from './dataflow';


function numberFormatExpr(expr: string, format: string) {
  return `format(${expr}, '${format}')`;
}

function addRangeFormula(model: Model, transform: VgTransform[], fieldDef: FieldDef, channel: Channel) {
    const discreteDomain = hasDiscreteDomain(model.scale(channel).type);
    if  (discreteDomain) {
      // read format from axis or legend, if there is no format then use config.numberFormat
      const format = (model.axis(channel) || model.legend(channel) || {}).format ||
        model.config.numberFormat;

      const startField = field(fieldDef, {datum: true, binSuffix: 'start'});
      const endField = field(fieldDef, {datum: true, binSuffix: 'end'});

      transform.push({
        type: 'formula',
        as: field(fieldDef, {binSuffix: 'range'}),
        expr: `${numberFormatExpr(startField, format)} + ' - ' + ${numberFormatExpr(endField, format)}`
      });
    }
}

export class BinNode extends DataFlowNode {
  private bins: Dict<VgTransform[]>;

  constructor(model: Model) {
    super();

    this.bins = model.reduceFieldDef(function(binComponent: Dict<VgTransform[]>, fieldDef: FieldDef, channel: Channel) {
      const fieldDefBin = model.fieldDef(channel).bin;
      if (fieldDefBin) {
        const bin: Bin = isBoolean(fieldDefBin) ? {} : fieldDefBin;
        const key = `${binToString(fieldDef.bin)}_${fieldDef.field}`;

        let transform: VgTransform[] = binComponent[key];

        if (!transform) {
          binComponent[key] = transform = [];
          const extentSignal = model.getName(key + '_extent');

          const binTrans: VgBinTransform = {
              type: 'bin',
              field: fieldDef.field,
              as: [field(fieldDef, {binSuffix: 'start'}), field(fieldDef, {binSuffix: 'end'})],
              signal: varName(model.getName(key + '_bins')),
              ...bin
          };
          if (!bin.extent) {
            transform.push({
              type: 'extent',
              field: fieldDef.field,
              signal: extentSignal
            });
            binTrans.extent = {signal: extentSignal};
          }
          transform.push(binTrans);
        }
        // if formula doesn't exist already
        if (transform.length > 0 && transform[transform.length - 1].type !== 'formula') {
          addRangeFormula(model, binComponent[key], fieldDef, channel);
        }
      }
      return binComponent;
    }, {});
  }

  public size() {
    return Object.keys(this.bins).length;
  }

  public merge(other: BinNode) {
    this.bins = extend(other.bins);
    other.remove();
  }

  public assemble(): VgTransform[] {
    return flatten(vals(this.bins));
  }
}
