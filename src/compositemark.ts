import {Encoding} from './encoding';
import {isMarkDef, MarkDef} from './mark';
import {GenericUnitSpec, LayerSpec} from './spec';
import {isDiscrete, isContinuous, PositionFieldDef} from './fielddef';

export const ERRORBAR: 'error-bar' = 'error-bar';
export type ERRORBAR = typeof ERRORBAR;
// TODO: export BOXPLOT (IQR ticks)
// export const BOXPLOT: 'boxplot' = 'boxplot';
// export type BOXPLOT = typeof BOXPLOT;
export const BOX: 'box' = 'box';
export type BOX = typeof BOX;

export type UnitNormalizer = (spec: GenericUnitSpec<any, any>)=> LayerSpec;

/**
 * Registry index for all composite mark's normalizer
 */
const normalizerRegistry: {[mark: string]: UnitNormalizer} = {};

export function add(mark: string, normalizer: UnitNormalizer) {
  normalizerRegistry[mark] = normalizer;
}

export function remove(mark: string) {
  delete normalizerRegistry[mark];
}

/**
 * Transform a unit spec with composite mark into a normal layer spec.
 */
export function normalize(
    // This GenericUnitSpec has any as Encoding because unit specs with composite mark can have additional encoding channels.
    spec: GenericUnitSpec<string | MarkDef, any>
  ): LayerSpec {

  const mark = isMarkDef(spec.mark) ? spec.mark.type : spec.mark;
  const normalizer = normalizerRegistry[mark];
  if (normalizer) {
    return normalizer(spec);
  }

  throw new Error(`Unregistered composite mark ${mark}`);
}



add(ERRORBAR, (spec: GenericUnitSpec<ERRORBAR, Encoding>): LayerSpec => {
  const {mark: _m, encoding: encoding, ...outerSpec} = spec;
  const {size: _s, ...encodingWithoutSize} = encoding;
  const {x2: _x2, y2: _y2, ...encodingWithoutX2Y2} = encoding;
  const {x: _x, y: _y, ...encodingWithoutX_X2_Y_Y2} = encodingWithoutX2Y2;

  if (!encoding.x2 && !encoding.y2) {
    throw new Error('Neither x2 or y2 provided');
  }

  return {
    ...outerSpec,
    layer: [
      {
        mark: 'rule',
        encoding: encodingWithoutSize
      },{ // Lower tick
        mark: 'tick',
        encoding: encodingWithoutX2Y2
      }, { // Upper tick
        mark: 'tick',
        encoding: encoding.x2 ? {
          x: encoding.x2,
          y: encoding.y,
          ...encodingWithoutX_X2_Y_Y2
        } : {
          x: encoding.x,
          y: encoding.y2,
          ...encodingWithoutX_X2_Y_Y2
        }
      }
    ]
  };
});

add(BOX, (spec: GenericUnitSpec<BOX, Encoding>): LayerSpec => {
  const {mark: _m, encoding: encoding, ...outerSpec} = spec;

  let fullEncoding: any = {};

  let isVertical: boolean;

  if (isDiscrete(encoding.x) && isContinuous(encoding.y)) {
    // vertical
    isVertical = true;
    const fieldDefEncodingY: PositionFieldDef = encoding.y;
    const encodingYWithoutAxis = {
      field: fieldDefEncodingY.field,
      type: fieldDefEncodingY.type
    };

    fullEncoding.noAggregate = encoding.x;
    fullEncoding.min = {
      aggregate: 'min',
      ...encodingYWithoutAxis
    };
    fullEncoding.minWithAxis = {
      axis: fieldDefEncodingY.axis,
      ...fullEncoding.min
    };
    fullEncoding.q1 = {
      aggregate: 'q1',
      ...encodingYWithoutAxis
    };
    fullEncoding.median = {
      aggregate: 'median',
      ...encodingYWithoutAxis
    };
    fullEncoding.q3 = {
      aggregate: 'q3',
      ...encodingYWithoutAxis
    };
    fullEncoding.max = {
      aggregate: 'max',
      ...encodingYWithoutAxis
    };


  } else if (isDiscrete(encoding.y) && isContinuous(encoding.x)) {
    // horizontal
    isVertical = false;
    const fieldDefEncodingX: PositionFieldDef = encoding.x;
    const encodingXWithoutAxis = {
      field: fieldDefEncodingX.field,
      type: fieldDefEncodingX.type
    };

    fullEncoding.noAggregate = encoding.y;
    fullEncoding.min = {
      aggregate: 'min',
      ...encodingXWithoutAxis
    };
    fullEncoding.minWithAxis = {
      axis: fieldDefEncodingX.axis,
      ...fullEncoding.min
    };
    fullEncoding.q1 = {
      aggregate: 'q1',
      ...encodingXWithoutAxis
    };
    fullEncoding.median = {
      aggregate: 'median',
      ...encodingXWithoutAxis
    };
    fullEncoding.q3 = {
      aggregate: 'q3',
      ...encodingXWithoutAxis
    };
    fullEncoding.max = {
      aggregate: 'max',
      ...encodingXWithoutAxis
    };
  } else {
    throw new Error('Need one continuous and one discrete axis');
  }

  return isVertical ? {
    ...outerSpec,
    layer: [
      {
        mark: 'rule',
        encoding: {
          x: fullEncoding.noAggregate,
          y: fullEncoding.minWithAxis,
          y2: fullEncoding.max
        }
      },{ // Lower tick
        mark: 'tick',
        encoding: {
          x: fullEncoding.noAggregate,
          y: fullEncoding.min,
          size: encoding.size
        }
      }, { // Upper tick
        mark: 'tick',
        encoding: {
          x: fullEncoding.noAggregate,
          y: fullEncoding.max,
          size: encoding.size
        }
      }, { // lower part of box (q1 to median)
        mark: 'bar',
        encoding: {
          x: fullEncoding.noAggregate,
          y: fullEncoding.q1,
          y2: fullEncoding.median,
          size: encoding.size
        }
      }, { // upper part of box (median to q3)
        mark: 'bar',
        encoding: {
          x: fullEncoding.noAggregate,
          y: fullEncoding.median,
          y2: fullEncoding.q3,
          size: encoding.size
        }
      }
    ]
  } : {
    ...outerSpec,
    layer: [
      {
        mark: 'rule',
        encoding: {
          y: fullEncoding.noAggregate,
          x: fullEncoding.minWithAxis,
          x2: fullEncoding.max
        }
      },{ // Lower tick
        mark: 'tick',
        encoding: {
          y: fullEncoding.noAggregate,
          x: fullEncoding.min,
          size: encoding.size
        }
      }, { // Upper tick
        mark: 'tick',
        encoding: {
          y: fullEncoding.noAggregate,
          x: fullEncoding.max,
          size: encoding.size
        }
      }, { // lower part of box (q1 to median)
        mark: 'bar',
        encoding: {
          y: fullEncoding.noAggregate,
          x: fullEncoding.q1,
          x2: fullEncoding.median,
          size: encoding.size
        }
      }, { // upper part of box (median to q3)
        mark: 'bar',
        encoding: {
          y: fullEncoding.noAggregate,
          x: fullEncoding.median,
          x2: fullEncoding.q3,
          size: encoding.size
        }
      }
    ]
  };
});

