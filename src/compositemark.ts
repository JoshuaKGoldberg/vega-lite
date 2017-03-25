import {Encoding} from './encoding';
import {isContinuous, isDiscrete, PositionFieldDef} from './fielddef';
import {isMarkDef, MarkDef} from './mark';
import {GenericUnitSpec, LayerSpec} from './spec';

export const ERRORBAR: 'error-bar' = 'error-bar';
export type ERRORBAR = typeof ERRORBAR;
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
  const {x: _x, y: _y, ...nonPositionEncoding} = encoding;

  let discreteAxisFieldDef, continuousAxisChannelDef: PositionFieldDef;
  let discreteAxis, continuousAxis;

  if (encoding.x && encoding.y) {
    // 2D
    if (isDiscrete(encoding.x) && isContinuous(encoding.y)) {
      // vertical
      discreteAxis = 'x';
      continuousAxis = 'y';
      continuousAxisChannelDef = encoding.y;

      discreteAxisFieldDef = encoding.x;
    } else if (isDiscrete(encoding.y) && isContinuous(encoding.x)) {
      // horizontal
      discreteAxis = 'y';
      continuousAxis = 'x';
      continuousAxisChannelDef = encoding.x;

      discreteAxisFieldDef = encoding.y;
    } else {
      throw new Error('Need one continuous and one discrete axis for 2D boxplots');
    }
  } else if (encoding.x && isContinuous(encoding.x) && encoding.y === undefined) {
    // 1D horizontal
    continuousAxis = 'x';
    continuousAxisChannelDef = encoding.x;
  } else if (encoding.x === undefined && encoding.y && isContinuous(encoding.y)) {
    // 1D vertical
    continuousAxis = 'y';
    continuousAxisChannelDef = encoding.y;
  } else {
    throw new Error('Need a continuous axis for 1D boxplots');
  }

  const continuousFieldType = {
      field: continuousAxisChannelDef.field,
      type: continuousAxisChannelDef.type
  };

  const minFieldDef = {
    aggregate: 'min',
    ...continuousFieldType
  };
  const minWithAxisFieldDef = {
    axis: continuousAxisChannelDef.axis,
    ...minFieldDef
  };
  const q1FieldDef = {
    aggregate: 'q1',
    ...continuousFieldType
  };
  const medianFieldDef = {
    aggregate: 'median',
    ...continuousFieldType
  };
  const q3FieldDef = {
    aggregate: 'q3',
    ...continuousFieldType
  };
  const maxFieldDef = {
    aggregate: 'max',
    ...continuousFieldType
  };

  const discreteAxisChannelDef = discreteAxisFieldDef !== undefined ? {[discreteAxis]: discreteAxisFieldDef} : {};

  return {
    ...outerSpec,
    layer: [
      {
        mark: 'rule',
        encoding: {
          ...discreteAxisChannelDef,
          [continuousAxis]: minWithAxisFieldDef,
          [continuousAxis + '2']: maxFieldDef,
          ...nonPositionEncoding
        }
      },{ // Lower tick
        mark: 'tick',
        encoding: {
          ...discreteAxisChannelDef,
          [continuousAxis]: minFieldDef,
          ...nonPositionEncoding
        }
      }, { // Upper tick
        mark: 'tick',
        encoding: {
          ...discreteAxisChannelDef,
          [continuousAxis]: maxFieldDef,
          ...nonPositionEncoding
        }
      }, { // lower part of box (q1 to median)
        mark: 'bar',
        encoding: {
          ...discreteAxisChannelDef,
          [continuousAxis]: q1FieldDef,
          [continuousAxis + '2']: medianFieldDef,
          ...nonPositionEncoding
        }
      }, { // upper part of box (median to q3)
        mark: 'bar',
        encoding: {
          ...discreteAxisChannelDef,
          [continuousAxis]: medianFieldDef,
          [continuousAxis + '2']: q3FieldDef,
          ...nonPositionEncoding
        }
      }
    ]
  };
});

