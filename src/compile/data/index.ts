import {TimeUnitNode} from './timeunit';

import { VgData } from '../../vega.schema';

import {COLUMN, ROW} from '../../channel';
import { MAIN, RAW } from '../../data';
import { field } from '../../fielddef';
import {Dict, every, vals} from '../../util';
import { FacetModel } from '../facet';
import {Model} from '../model';
import {UnitModel} from '../unit';
import {AggregateNode} from './aggregate';
import { BinNode } from './bin';
import { DataFlowNode, OutputNode } from './dataflow';
import { FacetAggregateNode, FacetNode } from './facet';
import {ParseNode} from './formatparse';
import {NonPositiveFilterNode} from './nonpositivefilter';
import { NullFilterNode } from './nullfilter';
import { OrderNode } from './pathorder';
import { SourceNode } from './source';
import {StackNode} from './stack';
import { CalculateNode, FilterNode, parseTransformArray } from './transforms';

export interface DataComponent {
  /**
   * A dictionary of sources indexed by a hash.
   */
  sources?: Dict<SourceNode>;

  //
  // Output nodes for use in marks, scales, layout, and others.
  //

  /**
   * Before aggregation.
   */
  raw?: OutputNode;

  /**
   * Main data source for mark encodings. Children should connect to this.
   */
  main?: OutputNode;

  /**
   * For facets, we store the reference to the root node.
   */
  facetRoot?: FacetNode;

  /**
   * Output nodes for axes of faceted charts.
   */
  row?: FacetAggregateNode;
  column?: FacetAggregateNode;
}

function parseRoot(model: Model, sources: Dict<SourceNode>): DataFlowNode {
  if (model.data) {
    // If we have data, try to insert it into existing sources.
    const source = new SourceNode(model);
    const hash = source.hash();
    if (hash in sources) {
      // use a reference if we already have a source
      return sources[hash];
    } else {
      // otherwise add a new one
      sources[hash] = source;
      return source;
    }
  } else {
    // If we don't have a source defined, use the parent's facet root or main.
    return model.parent.component.data.facetRoot || model.parent.component.data.main;
  }
}

/*
Description of the dataflow (http://asciiflow.com/):

     +--------+
     | Source |
     +---+----+
         |
         v
       Parse
         |
         v
     Transforms
(Filter, Compute, ...)
         |
         v
     Null Filter
         |
         v
      Binning
         |
         v
     Timeunit
         |
         v
      +--+--+
      | Raw |
      +-----+
         |
         v
     Aggregate
         |
         v
     Path Order
         |
         v
       Stack
         |
         v
      >0 Filter
         |
         v
   +----------+----> Child data...
   |   Main   |
   ++--------++----> Layout
    |        |
    v        v
+---+----+ +-+-----+
| Facet  | | Facet |
| Column | | Row   |
+--------+ +-------+

*/

export function parseData(model: Model): DataComponent {
  const root = parseRoot(model, model.component.data.sources);

  // the current head of the tree that we are appending to
  let head = root;

  // add format parse
  const parse = new ParseNode(model);
  parse.parent = root;
  head = parse;

  // handle transforms array
  if (model.transforms.length > 0) {
    const transforms = parseTransformArray(model);
    transforms.first.parent = head;
    head = transforms.last;
  }

  // add nullfilter
  const nullFilter = new NullFilterNode(model);
  if (Object.keys(nullFilter.aggregator).length) {
    nullFilter.parent = head;
    head = nullFilter;
  }

  // handle binning
  const bin = new BinNode(model);
  if (bin.size() > 0) {
    bin.parent = head;
    head = bin;
  }

  // handle time unit
  const tu = new TimeUnitNode(model);
  if (tu.size()) {
    tu.parent = head;
    head = tu;
  }

  // add an output node pre aggregation
  const raw = new OutputNode(RAW);
  raw.parent = head;
  head = raw;

  // handle aggregation
  if (model instanceof UnitModel) {
    const agg = new AggregateNode(model);
    if (agg.size()) {
      agg.parent = head;
      head = agg;
    }
  }

  if (model instanceof UnitModel) {
    const order = new OrderNode(model);
    if (order.hasFields()) {
      order.parent = head;
      head = order;
    }
  }

  if (model instanceof UnitModel && model.stack) {
    // handle stacking
    const stackTransforms = new StackNode(model);
    stackTransforms.parent = head;
    head = stackTransforms;
  }

  // add filter for non-positive data if needed
  const nonPosFilter2 = new NonPositiveFilterNode(model);
  if (nonPosFilter2.size() > 0) {
    nonPosFilter2.parent = head;
    head = nonPosFilter2;
  }

  // output node for marks
  const main = new OutputNode(MAIN);
  main.parent = head;
  head = main;

  // output nodes for facet summaries that we need to create axes on the outside
  let row: FacetAggregateNode = null;
  let column: FacetAggregateNode = null;
  if (model instanceof FacetModel) {
    if (model.facet.column) {
      column = new FacetAggregateNode(model, COLUMN);
      column.parent = head;
    }
    if (model.facet.row) {
      row = new FacetAggregateNode(model, ROW);
      row.parent = head;
    }
  }

  // add facet marker
  let facetRoot = null;
  if (model instanceof FacetModel) {
    facetRoot = new FacetNode(model);
    facetRoot.parent = head;
    head = facetRoot;
  }

  return {
    sources: model.component.data.sources,
    raw,
    main,
    facetRoot,
    row,
    column
  };
}

/**
 * use with optimizeFromLeaves
 */
function optimizeParse(node: DataFlowNode) {
  let next = node.parent;

  if (node.parent instanceof SourceNode) {
    return next;
  }

  // move parse up by merging or swapping
  if (node instanceof ParseNode) {
    if (node.parent instanceof ParseNode) {
      node.parent.merge(node);
    } else {
      next = node.parent;
      node.swapWithParent();
    }
  }

  return next;
}

/**
 * Use with optimizeFromLeaves.
 */
function optimizeBin(node: DataFlowNode) {
  let next = node.parent;

  if (node.parent instanceof SourceNode || node.parent instanceof CalculateNode) {
    return next;
  }

  // move parse up by merging or swapping
  if (node instanceof BinNode) {
    if (node.parent instanceof BinNode) {
      node.parent.merge(node);
    } else {
      next = node.parent;
      node.swapWithParent();
    }
  }

  return next;
}

function optimizeTimeUnit(node: DataFlowNode) {
  let next = node.parent;

  if (node.parent instanceof SourceNode || node.parent instanceof CalculateNode) {
    return next;
  }

  // move parse up by merging or swapping
  if (node instanceof TimeUnitNode) {
    if (node.parent instanceof TimeUnitNode) {
      node.parent.merge(node);
    } else {
      next = node.parent;
      node.swapWithParent();
    }
  }

  return next;
}

function optimizeAggregate(node: DataFlowNode) {
  let next = node.parent;

  if (node.parent instanceof SourceNode || node.parent instanceof CalculateNode || node.parent instanceof FilterNode) {
    return next;
  }

  // move parse up by merging or swapping
  if (node instanceof AggregateNode) {
    if (node.parent instanceof AggregateNode) {
      node.parent.merge(node);
    } else if (node.parent instanceof FacetNode) {
      // TODO: don't do this if we want independent scales
      node.addDimensions(node.parent.fields);
      node.swapWithParent();
    } else {
      next = node.parent;
      node.swapWithParent();
    }
  }

  return next;
}

function optimizeStack(node: DataFlowNode) {
  let next = node.parent;

  if (node.parent instanceof SourceNode || node.parent instanceof CalculateNode || node.parent instanceof FilterNode) {
    return next;
  }

  if (node instanceof StackNode) {
    if (node.parent instanceof FacetNode) {
      // TODO: don't do this if we want independent scales
      node.addDimensions(node.parent.fields);
    } else {
      next = node.parent;
    }
    node.swapWithParent();
  }

  return next;
}

function optimizeNullfilter(node: DataFlowNode) {
  let next = node.parent;

  if (node.parent instanceof SourceNode || node.parent instanceof CalculateNode) {
    return next;
  }

  // move parse up by merging or swapping
  if (node instanceof NullFilterNode) {
    if (node.parent instanceof NullFilterNode) {
      node.parent.merge(node);
    } else {
      next = node.parent;
      node.swapWithParent();
    }
  }

  return next;
}

function optimizeTransforms(node: DataFlowNode) {
  let next = node.parent;

  if (node.parent instanceof SourceNode) {
    return next;
  }

  // make sure we preserve the order between filter and calculate nodes

  if (node instanceof FilterNode) {
    if (node.parent instanceof FilterNode) {
      node.parent.merge(node);
    }

    if (!(node.parent instanceof CalculateNode)) {
      next = node.parent;
      node.swapWithParent();
    }
  }

  if (node instanceof CalculateNode) {
    if (!(node.parent instanceof FilterNode)) {
      next = node.parent;
      node.swapWithParent();
    }
  }

  return next;
}

/**
 * Start optimization path at the leaves. Useful for merging up things.
 */
function optimizeFromLeaves(f: (node: DataFlowNode) => DataFlowNode) {
  function optimizeNextFromLeaves(node: DataFlowNode) {
    if (!node.parent) {
      // done
      return;
    }

    optimizeNextFromLeaves(f(node));
  }

  return optimizeNextFromLeaves;
}

/**
 * Start optimization path from the root. Useful for removing nodes.
 */
function optimizeFromRoots(node: DataFlowNode) {
  // remove empty non positive filter
  if (node instanceof NonPositiveFilterNode && every(vals(node.filter), b => b === false)) {
    node.remove();
  }

  // remove empty null filter nodes
  if (node instanceof NullFilterNode && every(vals(node.aggregator), f => f === null)) {
    node.remove();
  }

  // remove output nodes that are not required
  if (node instanceof OutputNode && !node.required) {
    node.remove();
  }

  node.children.forEach(optimizeFromRoots);
}

/**
 * Return all leaf nodes.
 */
function getLeaves(roots: DataFlowNode[]) {
  const leaves: DataFlowNode[] = [];
  function append(node: DataFlowNode) {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      node.children.forEach(append);
    }
  }

  roots.forEach(append);
  return leaves;
}

function debug(node: DataFlowNode) {
  console.log(`${(node.constructor as any).name}${node.debugName ? ` (${node.debugName})` : ''} -> ${
    (node.children.map(c => {
      return `${(c.constructor as any).name}${c.debugName ? ` (${c.debugName})` : ''}`;
    }))
  }`);
  console.log(node);
  node.children.forEach(debug);
}

function makeWalkTree(data: VgData[]) {
  // to name datasources
  let datasetIndex = 0;

  /**
   * Recursively walk down the tree.
   */
  function walkTree(node: DataFlowNode, dataSource: VgData) {
    if (node instanceof ParseNode) {
      if (node.parent instanceof SourceNode && dataSource.format) {
        dataSource.format.parse = node.assemble();
      } else {
        throw new Error('Can only instantiate parse next to source.');
      }
    }

    if (node instanceof FacetNode) {
      // break here because the rest of the tree has to be taken care of by the facet.
      node.source = dataSource.source;
      return;
    }

    if (node instanceof FilterNode ||
      node instanceof NullFilterNode ||
      node instanceof CalculateNode ||
      node instanceof AggregateNode) {
      dataSource.transform.push(node.assemble());
    }

    if (node instanceof NonPositiveFilterNode ||
      node instanceof BinNode ||
      node instanceof TimeUnitNode ||
      node instanceof StackNode) {
      dataSource.transform = dataSource.transform.concat(node.assemble());
    }

    if (node instanceof FacetAggregateNode) {
      // Facet aggregate nodes are special output nodes where we know that they never have children.
      if (node.children.length > 0) {
        throw new Error('facet aggregate nodes cannot have children');
      }

      if (!dataSource.name) {
        dataSource.name = node.name;
      }

      dataSource.transform.push(node.assemble());
      data.push(dataSource);

      node.source = dataSource.name;

      return;  // no children means we can stop here
    } else if (node instanceof OutputNode) {
      if (dataSource.source && dataSource.transform.length === 0) {
        node.source = dataSource.source;
      } else if (node.parent instanceof OutputNode) {
        // Note that an output node may be required but we still do not assemble a
        // separate data source for it.
        node.source = dataSource.name;
      } else {
        if (!dataSource.name) {
          dataSource.name = `data_${datasetIndex++}`;
        }

        // Here we set the name of the datasource we generated. From now on
        // other assemblers can use it.
        node.source = dataSource.name;

        // if this node has more than one child, we will add a datasource automatically
        if (node.children.length === 1 && dataSource.transform.length > 0) {
          data.push(dataSource);
          const newData: VgData = {
            name: null,
            source: dataSource.name,
            transform: []
          };
          dataSource = newData;
        }
      }
    }

    switch (node.children.length) {
      case 0:
        // done
        if (!dataSource.source || dataSource.transform.length > 0) {
          // do not push empty datasources that are simply references
          data.push(dataSource);
        }
        break;
      case 1:
        walkTree(node.children[0], dataSource);
        break;
      default:
        let source = dataSource.name;
        if (!dataSource.source || dataSource.transform.length > 0) {
          data.push(dataSource);
        } else {
          source = dataSource.source;
        }

        node.children.forEach(child => {
          const newData: VgData = {
            name: null,
            source: source,
            transform: []
          };
          walkTree(child, newData);
        });
        break;
    }
  }

  return walkTree;
}

export function assembleFacetData(root: FacetNode): VgData[] {
  const data: VgData[] = [];
  const walkTree = makeWalkTree(data);

  root.children.forEach(child => walkTree(child, {
    source: root.name,
    transform: [],
    name: null
  }));

  return data;
}

/**
 * Creates Vega Data array from a given compiled model and append all of them to the given array
 *
 * @param  model
 * @param  data array
 * @return modified data array
 */
export function assembleData(roots: SourceNode[]): VgData[] {
  const data: VgData[] = [];

  roots.forEach(optimizeFromRoots);

  getLeaves(roots).forEach(optimizeFromLeaves(optimizeStack));
  getLeaves(roots).forEach(optimizeFromLeaves(optimizeAggregate));
  getLeaves(roots).forEach(optimizeFromLeaves(optimizeBin));
  getLeaves(roots).forEach(optimizeFromLeaves(optimizeTimeUnit));
  getLeaves(roots).forEach(optimizeFromLeaves(optimizeNullfilter));
  getLeaves(roots).forEach(optimizeFromLeaves(optimizeTransforms));
  getLeaves(roots).forEach(optimizeFromLeaves(optimizeParse));

  // TODO: merge things

  roots.forEach(debug);

  const walkTree = makeWalkTree(data);

  let sourceIndex = 0;

  roots.forEach(root => {
    // assign a name if the source does not have a name yet
    if (!root.hasName()) {
      root.dataName = `source_${sourceIndex++}`;
    }

    const newData: VgData = root.assemble();

    walkTree(root, newData);
  });

  return data;

  // // Path Order
  // const pathOrderCollectTransform = pathOrder.assemble(dataComponent.pathOrder);
  // if (pathOrderCollectTransform) {
  //   const dataTable = data[data.length - 1];
  //   if (data.length > 0) {
  //     dataTable.transform = (dataTable.transform || []).concat([pathOrderCollectTransform]);
  //   } else { /* istanbul ignore else: should never reach here */
  //     throw new Error('Invalid path order collect transform not added');
  //   }
  // }

  // return data;
}
