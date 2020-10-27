import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | engine-flag-event', function(hooks) {
  setupTest(hooks);

  // TODO: Replace this with your real tests.
  test('it exists', function(assert) {
    let service = this.owner.lookup('service:engine-flag-event');
    assert.ok(service);
  });
});
