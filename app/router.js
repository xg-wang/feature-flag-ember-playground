import EmberRouter from '@embroider/router';
import config from './config/environment';
import { FeatureFlags } from './lib/flag-cache';

function mountFlagedEngine(/*this: DSLImpl*/engineMountPoint) {
  const engineConfig = FeatureFlags.routingFlags.mountPoints[engineMountPoint];
  if (FeatureFlags.flags[engineConfig.key] === 'enabled') {
    this.mount(engineConfig.enabledEngine, { as: engineMountPoint });
  } else {
    this.mount(engineMountPoint);
  }
}

export default class Router extends EmberRouter {
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
