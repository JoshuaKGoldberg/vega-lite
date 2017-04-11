import {field, FieldDef} from '../../fielddef';
import { fieldExpr, TimeUnit } from '../../timeunit';
import {TEMPORAL} from '../../type';
import {Dict, extend, vals} from '../../util';
import {VgFormulaTransform} from '../../vega.schema';
import { format } from '../axis/rules';
import {Model} from '../model';
import {DataFlowNode} from './dataflow';

export class TimeUnitNode extends DataFlowNode {
  private formula: Dict<VgFormulaTransform>;

  constructor(model: Model) {
    super();

    this.formula = model.reduceFieldDef((timeUnitComponent, fieldDef: FieldDef) => {
      if (fieldDef.type === TEMPORAL && fieldDef.timeUnit) {
        const f = field(fieldDef);
        timeUnitComponent[f] = {
          type: 'formula',
          as: f,
          expr: fieldExpr(fieldDef.timeUnit, fieldDef.field)
        };
      }
      return timeUnitComponent;
    }, {} as Dict<VgFormulaTransform>);
  }

  public size() {
    return Object.keys(this.formula).length;
  }

  public merge(other: TimeUnitNode) {
    this.formula = extend(this.formula, other.formula);
    other.remove();
  }

  public assemble() {
    return vals(this.formula);
  }
}
