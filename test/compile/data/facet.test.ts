import {assert} from 'chai';
import {FacetNode} from '../../../src/compile/data/facet';
import {COLUMN_AXES_DATA_PREFIX, FacetModel, ROW_AXES_DATA_PREFIX} from '../../../src/compile/facet';
import {parseFacetModel} from '../../util';

function assemble(model: FacetModel) {
  const node = new FacetNode(model);
  node.source = 'source';
  return node.assemble();
}

describe('compile/data/facet', function() {
  describe('assembleAxesGroupData', () => {
    it('should output row-source when there is row', () => {
      const model = parseFacetModel({
        facet: {
          row: {field: 'a', type: 'ordinal'}
        },
        spec: {
          mark: 'point',
          encoding: {}
        }
      });

      // HACK: mock that we have parsed its data and there is no stack and no summary
      // This way, we won't have surge in test coverage for the parse methods.
      model.component.data = {} as any;
      model['hasSummary'] = () => false;

      assert.deepEqual(
        assemble(model),
        [{
          name: ROW_AXES_DATA_PREFIX + 'source',
          source: 'source',
          transform: [{
            type: 'aggregate',
            groupby: ['a']
          }]
        }]
      );
    });

    it('should output column-source when there is column', () => {
      const model = parseFacetModel({
        facet: {
          column: {field: 'a', type: 'ordinal'}
        },
        spec: {
          mark: 'point',
          encoding: {}
        }
      });

      // HACK: mock that we have parsed its data and there is no stack and no summary
      // This way, we won't have surge in test coverage for the parse methods.
      model.component.data = {} as any;
      model['hasSummary'] = () => false;

      assert.deepEqual(
        assemble(model),
        [{
          name: COLUMN_AXES_DATA_PREFIX + 'source',
          source: 'source',
          transform: [{
            type: 'aggregate',
            groupby: ['a']
          }]
        }]
      );
    });

    it('should output row- and column-source when there are both row and column', () => {
      const model = parseFacetModel({
        facet: {
          column: {field: 'a', type: 'ordinal'},
          row: {field: 'b', type: 'ordinal'}
        },
        spec: {
          mark: 'point',
          encoding: {}
        }
      });

      // HACK: mock that we have parsed its data and there is no stack and no summary
      // This way, we won't have surge in test coverage for the parse methods.
      model.component.data = {} as any;
      model['hasSummary'] = () => false;

      assert.deepEqual(
        assemble(model),
        [{
          name: COLUMN_AXES_DATA_PREFIX + 'source',
          source: 'source',
          transform: [{
            type: 'aggregate',
            groupby: ['a']
          }]
        },{
          name: ROW_AXES_DATA_PREFIX + 'source',
          source: 'source',
          transform: [{
            type: 'aggregate',
            groupby: ['b']
          }]
        }]
      );
    });
  });
});
