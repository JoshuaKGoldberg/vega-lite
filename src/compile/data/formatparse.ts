import {isUrlData} from '../../data';
import {DateTime, isDateTime} from '../../datetime';
import {FieldDef, isCount} from '../../fielddef';
import {isEqualFilter, isOneOfFilter, isRangeFilter} from '../../filter';
import {QUANTITATIVE, TEMPORAL} from '../../type';
import {Dict, isArray, isNumber, isString, keys} from '../../util';

 import {CalculateTransform, FilterTransform, isCalculate, isFilter} from '../../transform';
import {Model} from './../model';
import {DataFlowNode} from './dataflow';

export class ParseNode extends DataFlowNode {
  private parse: Dict<string> = {};

  constructor(model: Model) {
    super();

    const calcFieldMap = model.transforms.filter(isCalculate).reduce((fieldMap, formula: CalculateTransform) => {
      fieldMap[formula.as] = true;
      return fieldMap;
    }, {});

    // Parse filter fields
    model.transforms.filter(isFilter).forEach((transform: FilterTransform) => {
      let filter = transform.filter;
      if (!isArray(filter)) {
        filter = [filter];
      }
      filter.forEach(f => {
        let val: string | number | boolean | DateTime = null;
        // For EqualFilter, just use the equal property.
        // For RangeFilter and OneOfFilter, all array members should have
        // the same type, so we only use the first one.
        if (isEqualFilter(f)) {
          val = f.equal;
        } else if (isRangeFilter(f)) {
          val = f.range[0];
        } else if (isOneOfFilter(f)) {
          val = (f.oneOf || f['in'])[0];
        } // else -- for filter expression, we can't infer anything

        if (!!val) {
          if (isDateTime(val)) {
            this.parse[f['field']] = 'date';
          } else if (isNumber(val)) {
            this.parse[f['field']] = 'number';
          } else if (isString(val)) {
            this.parse[f['field']] = 'string';
          }
        }
      });
    });

    // Parse encoded fields
    model.forEachFieldDef((fieldDef: FieldDef) => {
      if (fieldDef.type === TEMPORAL) {
        this.parse[fieldDef.field] = 'date';
      } else if (fieldDef.type === QUANTITATIVE) {
        if (isCount(fieldDef) || calcFieldMap[fieldDef.field]) {
          return;
        }
        this.parse[fieldDef.field] = 'number';
      }
    });

    // Custom parse should override inferred parse
    const data = model.data;
    if (data && isUrlData(data) && data.format && data.format.parse) {
      const parse = data.format.parse;
      keys(parse).forEach((field) => {
        this.parse[field] = parse[field];
      });
    }
  }

  public assemble() {
    return this.parse;
  }
}
