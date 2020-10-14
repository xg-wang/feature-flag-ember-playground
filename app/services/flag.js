import Service, { inject as service } from '@ember/service';
import { all } from 'rsvp';

export default Service.extend({
  router: service('router'),
  init() {
    this._super(...arguments);
    this.ROUTE_FLAGS_MAP = new Map([
      [
        FLAGS,
        new Map([
          [TOP_LEVEL_FLAGS, new Map()],
          [INHERIT_FLAGS, new Map()],
        ]),
      ],
    ]);
    this.router.on('routeWillChange', ({ from, to, routeInfos }) => {
      const fromList = createList(from);
      const toList = createList(to);
      const { pivot } = diffRoutes({ fromList, toList });
      let routePromises = routeInfos.map((info) => info.routePromise);
      // application -> profile -> connections
      updateFlagsMapForRouteHierarchy(this.ROUTE_FLAGS_MAP, routePromises, pivot);
    });
  },
  // when get-route-info lands we can drop private API usage
  snapshotFromRouteName(routeName) {
    const privateRouter = this.router._router._routerMicrolib;
    const snapshot = privateRouter.getRoute(routeName).flags._snapshotSync();
    console.log(`snapshotFromRouteName "${routeName}"`);
    return snapshot;
  },
  getFlag(key) {
    return STORE.get(key);
  },
  getFlagIsEnabled(key) {
    return getFlagIsEnabled(key);
  },
});

async function updateFlagsMapForRouteHierarchy(
  routeFlagsMap,
  routePromises,
  pivot
) {
  // init flags map for each route hierarchy
  let ptr = routeFlagsMap;
  for (let i = 0; i < routePromises.length; i++) {
    // TODO: this is relying on routerjs resolves model in a later micro stack, we can win the race :)
    // a more reliable approach is to have snapshot wait.
    await routePromises[i].then((route) => {
      console.log(`[async route resolve] resolved ${route.fullRouteName}`);
      const localName = routeLocalName(route.fullRouteName);
      if (!ptr.has(localName)) {
        ptr.set(localName, new Map([[PARENT, ptr]]));
      }
      ptr = ptr.get(localName);
      // TODO: figure out if we can use buildRouteInfoMetadata
      const { flags } = route;
      // flags.keys: ['a', 'b']
      if (flags && !ptr.has(FLAGS)) {
        const parentFlagsMap = ptr.get(PARENT).get(FLAGS);
        const topLevelFlagsEntries = flags.keys
          .filter(
            (f) =>
              !parentFlagsMap.get(TOP_LEVEL_FLAGS).has(f) &&
              !parentFlagsMap.get(INHERIT_FLAGS).has(f)
          )
          .map((f) => [f, new FlagRef(f)]);
        const inheritFlagsEntries = Array.from(
          parentFlagsMap.get(INHERIT_FLAGS).entries()
        ).concat(Array.from(parentFlagsMap.get(TOP_LEVEL_FLAGS).entries()));
        const flagsMapForThisLevel = new Map([
          [TOP_LEVEL_FLAGS, new Map(topLevelFlagsEntries)],
          [INHERIT_FLAGS, new Map(inheritFlagsEntries)],
        ]);
        ptr.set(FLAGS, flagsMapForThisLevel);
        FLAGS_TO_MAP.set(flags, ptr);
      }
      // update flags for routes that are below pivot
      if (i >= pivot) {
        if (flags) {
          const ptr = FLAGS_TO_MAP.get(flags);
          for (const v of ptr.get(FLAGS).get(TOP_LEVEL_FLAGS).values()) {
            v.update();
          }
        }
      }
    });
  }
}

class FlagRef {
  constructor(key) {
    this._key = key;
    this._cache = STORE.get(key);
  }
  get value() {
    return this._cache;
  }
  update() {
    this._cache = STORE.get(this._key);
  }
}

const STORE = new Map(
  Object.entries(
    JSON.parse(
      decodeURI(document.querySelector('meta[name=feature-flags]').content)
    ).flags
  )
);

export function getFlag(key) {
  return STORE.get(key) || 'control';
}

export function getFlagIsEnabled(key) {
  return getFlag(key) !== 'control';
}

export function updateFlag(key) {
  const newValue = STORE.get(key) + 1;
  STORE.set(key, newValue);
}

export function setFlag(key, value) {
  STORE.set(key, value);
}

const PARENT = '.parent';
const FLAGS = '.flags';
const TOP_LEVEL_FLAGS = '.TOP_LEVEL_FLAGS';
const INHERIT_FLAGS = '.INHERIT_FLAGS';

const FLAGS_TO_MAP = new WeakMap();

// TODO: make evaluation tracked?
export class FlagEvaluator {
  constructor(keys) {
    this.keys = keys;
  }
  _snapshotSync() {
    const flagsMap = FLAGS_TO_MAP.get(this).get(FLAGS);
    const snapshot = Object.create(null);
    for (let key of this.keys) {
      const value = flagsMap.get(TOP_LEVEL_FLAGS).has(key)
        ? flagsMap.get(TOP_LEVEL_FLAGS).get(key).value
        : flagsMap.get(INHERIT_FLAGS).get(key).value;
      Object.defineProperty(snapshot, key, {
        get() {
          notifyEvaluation({ key, value });
          return value;
        },
        enumerable: true,
      });
    }
    return snapshot;
  }
  snapshot() {
    return Promise.resolve(this._snapshotSync());
  }
}

// Utils
function notifyEvaluation({ key, value }) {
  // sendBeacon('/feature-falg-analytics')
  console.log(`${key} evaled as ${value}`);
}
function createList(routeInfo) {
  const ret = [];
  if (routeInfo === null) {
    return ret;
  }
  routeInfo.find((item) => {
    ret.push(item);
    return false;
  });
  return ret;
}

function diffRoutes({ fromList, toList }) {
  for (let i = 0; i < toList.length; i++) {
    const toSegment = toList[i];
    const fromSegment = fromList[i];
    if (!toSegment || !fromSegment) {
      return { pivot: i };
    }
    const { name: toName, params: toParams } = toList[i];
    const { name: fromName, params: fromParams } = fromList[i];
    if (toName !== fromName || !objectsMatch(toParams, fromParams))
      return { pivot: i };
  }
  return { pivot: toList.length };
}

function routeLocalName(routeName) {
  let parts = routeName.split('.');
  return parts[parts.length - 1];
}

function objectsMatch(obj1, obj2) {
  if (obj1 === undefined && obj2 === undefined) {
    return true;
  }
  if (
    (obj1 !== undefined && obj2 === undefined) ||
    (obj1 === undefined && obj2 !== undefined)
  ) {
    return false;
  }
  let fromKeys = Object.keys(obj1);
  let toKeys = Object.keys(obj2);
  if (fromKeys.length === toKeys.length) {
    for (let i = 0; i < fromKeys.length; i++) {
      let fromKey = fromKeys[i];
      if (toKeys.indexOf(fromKey) === -1) {
        return false;
      }
      if (obj1[fromKey] !== obj2[fromKey]) {
        return false;
      }
    }
    return true;
  }
  return false;
}
