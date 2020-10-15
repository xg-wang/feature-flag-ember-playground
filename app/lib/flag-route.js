const ROUTE_LIX_ENABLED_KEY = '__route_lix_is_enabled';

function generateRouteHandler(owner, key, treatmentRouteName) {
  const treatmentRoute = owner.lookup(`route:${treatmentRouteName}`);
  const flagService = owner.lookup('service:flag');
  return {
    set(target, prop, value) {
      const flagIsEnabled = Reflect.get(target, ROUTE_LIX_ENABLED_KEY);
      if (prop === 'controller') {
        // Set the other controller too, because _internalReset assumes controller is set once route is setup
        if (flagIsEnabled) {
          Reflect.set(
            target,
            prop,
            owner.lookup(`controller:${Reflect.get(target, 'routeName')}`)
          );
        } else {
          Reflect.set(
            treatmentRoute,
            prop,
            owner.lookup(`controller:${treatmentRouteName}`)
          );
        }
      }
      return Reflect.set(flagIsEnabled ? treatmentRoute : target, prop, value);
    },
    get(target, prop, _receiver) {
      let flagIsEnabled = Reflect.get(target, ROUTE_LIX_ENABLED_KEY);
      if (typeof flagIsEnabled === 'undefined') {
        flagIsEnabled = flagService.getFlagIsEnabled(key);
        Reflect.set(target, ROUTE_LIX_ENABLED_KEY, flagIsEnabled);
      }
      if (prop === 'routeName') {
        return flagIsEnabled ? treatmentRouteName : Reflect.get(target, prop);
      }
      return Reflect.get(flagIsEnabled ? treatmentRoute : target, prop);
    },
  };
}

export function setupFlaggedRoute(
  ControlRouteClass,
  { flagKey, enabledRouteName }
) {
  if (navigator.userAgent.indexOf('MSIE') > -1) {
    return ControlRouteClass;
  }
  return class FlagRoute extends ControlRouteClass {
    constructor(owner) {
      super(...arguments);
      return new Proxy(
        this,
        generateRouteHandler(owner, flagKey, enabledRouteName)
      );
    }
  };
}
