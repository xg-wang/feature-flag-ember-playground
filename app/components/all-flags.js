import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class AllFlagsComponent extends Component {
  @service flag;
  @tracked applicationFlag = this.flag.getFlag('application');
  @tracked educationFlag = this.flag.getFlag('education');
  @tracked aFlag = this.flag.getFlag('a');
  @tracked bFlag = this.flag.getFlag('b');
  @action update(key) {
    this.flag.updateFlag(key);
    this[key + 'Flag'] = this.flag.getFlag(key);
    console.log(`STORE[${key}] updated to ${this.flag.getFlag(key)}`);
  }
  @action setFlag(key, value) {
    this.flag.setFlag(key, value);
    this[key + 'Flag'] = this.flag.getFlag(key);
    console.log(`STORE[${key}] updated to ${this.flag.getFlag(key)}`);
  }
}
