import EmberRouter from '@ember/routing/router';
import config from './config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('profile', { path: 'profile/:profile_id' }, function () {
    this.route('connections');
    this.route('education');
  });
  this.mount('super-blog');
  this.mount('about');
});
