import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { flag } from '../decorators/flag';

export default class ProfileRoute extends Route {
  @flag(['a']) flags;
  async model({ profile_id }) {
    console.log('model() profile');
    return {
      profile_id,
      flags: await this.flags.snapshot(),
    };
  }

  @action
  refreshOnRoute() {
    console.log('profile route refresh..')
    this.refresh();
  }
}
