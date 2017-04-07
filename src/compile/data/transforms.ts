

 import {expression, Filter} from '../../filter';
import {CalculateTransform, FilterTransform, isCalculate, isFilter} from '../../transform';
import {VgFilterTransform, VgFormulaTransform} from '../../vega.schema';
import {Model} from '../model';
import {DataFlowNode} from './dataflow';

export class FilterNode extends DataFlowNode {
  private filter: Filter | Filter[];

  constructor(transform: FilterTransform) {
    super();

    this.filter = transform.filter;
  }

  public assemble(): VgFilterTransform {
    return {
      type: 'filter',
      expr: expression(this.filter)
    };
  }
}

export class CalculateNode extends DataFlowNode {

  constructor(private transform: CalculateTransform) {
    super();
  }

  public assemble(): VgFormulaTransform {
    return {
      type: 'formula',
      expr: this.transform.calculate,
      as: this.transform.as
    };
  }
}

export function parseTransformArray(model: Model) {
  let first: DataFlowNode;
  let last: DataFlowNode;
  let node: DataFlowNode;

  model.transforms.forEach((t, i) => {
    if (isCalculate(t)) {
      node = new CalculateNode(t);
    } else if (isFilter(t)) {
      node = new FilterNode(t);
    } else {
      return;
    }

    if (i === 0) {
      first = node;
    }
  });

  last = node;

  return {first, last};
}
