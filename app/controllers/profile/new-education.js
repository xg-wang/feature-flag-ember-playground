import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class NewEducationController extends Controller {
  @tracked
  newCount = 0;

  @action
  incrementNewCount() {
    this.newCount += 1;
  }
}

