import Ember from 'ember';
import EmberRouter from '@ember/routing/router';
import EmbroiderRouter from '@embroider/router';
import { assert } from '@ember/debug';
import config from './config/environment';
import { getOwner } from '@ember/application';

function mountFlagedEngine(/*this: DSLImpl*/ engineMountPoint) {
  const { enabled, enabledEngine } = this.options.getFlagedEngine(
    engineMountPoint
  );
  console.log(`enabledEngine: ${enabledEngine}`);
  if (enabled) {
    this.mount(enabledEngine, { as: engineMountPoint });
  } else {
    this.mount(engineMountPoint);
  }
}

function engineFlag(constructor) {
  assert(
    '@engineFlag decorator can only be used on the EmberRouter class',
    constructor.prototype instanceof EmberRouter
  );
  return class extends constructor {
    _buildDSL() {
      let enableLoadingSubstates = this._hasModuleBasedResolver();
      let router = this;
      let owner = getOwner(this);
      let options = {
        enableLoadingSubstates,
        resolveRouteMap(name) {
          return owner.factoryFor(`route-map:${name}`);
        },
        addRouteForEngine(name, engineInfo) {
          if (!router._engineInfoByRoute[name]) {
            router._engineInfoByRoute[name] = engineInfo;
          }
        },
        getFlagedEngine(engineMountPoint) {
          return owner.lookup('service:flag').getFlagedEngine(engineMountPoint);
        },
      };

      return new Ember.RouterDSL(null, options);
    }
  };
}

@engineFlag
export default class Router extends EmbroiderRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('profile', { path: 'profile/:profile_id' }, function () {
    this.route('connections');
    this.route('education');
  });
  mountFlagedEngine.call(this, 'super-blog');
  mountFlagedEngine.call(this, 'about');
});
