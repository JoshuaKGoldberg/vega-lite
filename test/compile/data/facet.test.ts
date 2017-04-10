import {assert} from 'chai';
import {FacetAggregateNode} from '../../../src/compile/data/facet';
import {FacetModel} from '../../../src/compile/facet';
import {parseFacetModel} from '../../util';

function parse(model: FacetModel, channel: 'row' | 'column') {
  return new FacetAggregateNode(model, channel);
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

      const facet = parse(model, 'row');

      assert(facet.name, 'row');
      assert.deepEqual(
        facet.assemble(),
        {
          type: 'aggregate',
          groupby: ['a']
        }
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

      const facet = parse(model, 'column');

      assert(facet.name, 'column');

      assert.deepEqual(
        facet.assemble(),
        {
          type: 'aggregate',
          groupby: ['a']
        }
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

      const row = parse(model, 'row');
      const col = parse(model, 'column');

      assert(row.name, 'row');
      assert(col.name, 'column');

      assert.deepEqual(
        row.assemble(),
        {
          type: 'aggregate',
          groupby: ['b']
        }
      );

      assert.deepEqual(
        col.assemble(),
        {
          type: 'aggregate',
          groupby: ['a']
        }
      );
    });
  });
});
