import Route from '@ember/routing/route';
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
}
