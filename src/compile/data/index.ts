import {TimeUnitNode} from './timeunit';

import {VgData} from '../../vega.schema';

import {MAIN, RAW} from '../../data';
import {Dict, every, vals} from '../../util';
import {Model} from '../model';
import {UnitModel} from '../unit';
import {FacetModel} from './../facet';
import {AggregateNode} from './aggregate';
import {BinNode} from './bin';
import {DataFlowNode, OutputNode} from './dataflow';
import {FacetNode} from './facet';
import {ParseNode} from './formatparse';
import {NonPositiveFilterNode} from './nonpositivefilter';
import {NullFilterNode} from './nullfilter';
import {SourceNode} from './source';
import {StackNode} from './stack';
import {CalculateNode, FilterNode, parseTransformArray} from './transforms';

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
  root?: FacetNode;
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
    // If we don't have a source defined, use the parent.
    return model.parent.component.data.main;
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
       Stack
         |
         v
      >0 Filter
         |
         v
     +---+---+
     | Main  +-----> Child data...
     +---+---+
         |
         v
       Layout

*/

export function parseData(model: Model): DataComponent {
  const sources = model.parent ? model.parent.component.data.sources : {};

  const root = parseRoot(model, sources);

  // the current head of the tree that we are appending to
  let head = root;

  // add format parse
  const parse = new ParseNode(model);
  parse.parent = root;
  head = parse;

  // FIXME
  // add facet if this is a facet model
  if (model instanceof FacetModel) {
    const facet = new FacetNode(model);
    facet.parent = head;
    head = facet;
  }

  // handle transforms array
  if (model.transforms.length > 0) {
    const transforms = parseTransformArray(model);
    transforms.first.parent = head;
    head = transforms.last;
  }

  // add nullfilter
  const nullFilter = new NullFilterNode(model);
  nullFilter.parent = head;
  head = nullFilter;

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
  const raw = new OutputNode(model.getName(RAW));
  raw.parent = head;
  head = raw;

  // handle aggregation
  const agg = new AggregateNode(model);
  if (agg.size()) {
    agg.parent = head;
    head = agg;
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
  const main = new OutputNode(model.getName(MAIN), true);  // required by default
  main.parent = head;
  head = main;

  return {
    sources,
    raw,
    main
  };
}

export function assembleFacetData(root: FacetNode): VgData[] {
  return [];
}

function optimize(node: DataFlowNode) {
  // remove empty non positive filter
  if (node instanceof NonPositiveFilterNode && every(vals(node.filter), b => b === false)) {
    node.remove();
  }

  // remove output nodes that are not needed
  if (node instanceof OutputNode && !node.needsAssembly()) {
    node.remove();
  }

  node.children.map(optimize);
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

  roots.map(optimize);

  /**
   * Recursively walk down the tree.
   */
  function walkTree(node: DataFlowNode, dataSource: VgData) {
    if (node instanceof ParseNode) {
      if (node.parent instanceof SourceNode && dataSource.format) {
        dataSource.format.parse = node.assemble();
      } else {
        throw new Error('noooooo');
      }
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

    if (node instanceof OutputNode) {
      if (node.needsAssembly()) {
        if (!dataSource.name) {
          dataSource.name = node.name;
        }

        // if this not has more than one child, we will add a datasource automatically
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

      // Here we set the name of the datasource we geenrated. From now on
      // other assemblers can use it.
      node.source = dataSource.name;
    }

    if (node instanceof FacetNode) {
      // stop here, rest will be taken care of later
      node.source = dataSource.name;
      data.push(dataSource);
      return;
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
        data.push(dataSource);
        node.children.forEach(child => {
          const newData: VgData = {
            name: null,
            source: dataSource.name,
            transform: []
          };
          walkTree(child, newData);
        });
        break;
    }
  }

  let sourceIndex = 0;

  roots.forEach(root => {
    // assign a name if the source does not have a name yet
    if (!root.hasName()) {
      root.name = `source_${sourceIndex++}`;
    }

    const newData: VgData = root.assemble();

    walkTree(root, newData);
  });

  console.log(data);

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
