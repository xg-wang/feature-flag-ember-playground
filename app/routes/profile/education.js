import Route from '@ember/routing/route';
import { setupFlaggedRoute } from './../../lib/flag-route';

export default setupFlaggedRoute(
  class OldEducationRoute extends Route {
    model() {
      return {
        message: 'This is the old education page',
      };
    }
  },
  {
    flagKey: 'education',
    enabledRouteName: 'profile/new-education',
  }
);
