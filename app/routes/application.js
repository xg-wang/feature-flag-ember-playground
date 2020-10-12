import Route from '@ember/routing/route';
import { flag } from '../decorators/flag';

export default class ApplicationRoute extends Route {
  @flag(['application']) flags;
  async model() {
    console.log('model() application');
    return {
      flags: await this.flags.snapshot(),
    };
  }
}
