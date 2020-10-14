import EmberRouter from '@embroider/router';
import config from './config/environment';

function mountFlagedEngine(/*this: DSLImpl*/engineMountPoint) {
  const flagConfig = JSON.parse(
    decodeURI(document.querySelector('meta[name=feature-flags]').content)
  );
  const engineConfig = flagConfig.routingFlags.mountPoints[engineMountPoint];
  if (flagConfig.flags[engineConfig.key] === 'enabled') {
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
