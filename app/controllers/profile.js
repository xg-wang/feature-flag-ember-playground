import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class ProfileController extends Controller {
  @action
  refreshRoute() {
    this.send('refreshOnRoute');
  }
}
