import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EducationController extends Controller {
  @tracked
  oldCount = 0;

  @action
  incrementOldCount() {
    this.oldCount += 1;
  }
}

