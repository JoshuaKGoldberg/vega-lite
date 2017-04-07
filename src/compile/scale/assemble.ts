import {isArray} from 'vega-util';
import {DataSourceType} from '../../data';
import {vals} from '../../util';
import {isDataRefDomain, isDataRefUnionedDomain, isFieldRefUnionDomain, isSignalRefDomain} from '../../vega.schema';
import {Model} from '../model';

export function assembleScale(model: Model) {
    return vals(model.component.scales).map(scale => {
      const domain = scale.domain;
      if (isDataRefDomain(domain)) {
        domain.data = model.dataName(domain.data as DataSourceType);
        return scale;
      } else if (isDataRefUnionedDomain(domain)) {
        return scale;
      } else if (isFieldRefUnionDomain(domain)) {
        domain.data = model.dataName(domain.data as DataSourceType);
        return scale;
      } else if (isSignalRefDomain(domain)) {
        return scale;
      } else if (isArray(domain)) {
        return scale;
      } else {
        throw new Error('invalid scale domain');
      }
    });
}
