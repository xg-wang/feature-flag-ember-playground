import Route from '@ember/routing/route';
import { flagEvaluator } from '../../decorators/flag';

export default Route.extend({
  flags: flagEvaluator(['a', 'b']),
  async model() {
    console.log('model() profile.connections');
    return {
      flags: await this.flags.snapshot()
    };
  }
});
