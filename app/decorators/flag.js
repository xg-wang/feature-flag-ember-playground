import { assert } from '@ember/debug';
import { FlagEvaluator } from '../services/flag';

export function flagEvaluator(keys) {
  assert('You must provide a list of required flag keys', Array.isArray(keys));
  return Object.freeze(new FlagEvaluator(keys));
}

export const flag = (keys) => {
  assert('You must provide a list of required flag keys', Array.isArray(keys));
  return (_target, _key, desc) => {
    desc.initializer = (_route) => Object.freeze(new FlagEvaluator(keys));
    return desc;
  };
};
