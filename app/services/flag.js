import Service, { inject as service } from '@ember/service';

export default Service.extend({
  router: service('router'),
  init() {
    this._super(...arguments);
    this.FeatureFlags = Object.freeze({
      flags: {
        a: 0,
        b: 0,
        education: 'enabled',
        application: 0,
        'new.about': 'enabled',
        'new.super-blog': 'enabled',
      },
      routingFlags: {
        mountPoints: {
          about: { key: 'new.about', enabledEngine: 'new-about' },
          'super-blog': {
            key: 'new.super-blog',
            enabledEngine: 'new-super-blog',
          },
        },
      },
    });
    this.STORE = new Map(Object.entries(this.FeatureFlags.flags));
    const topLevelFlagsManager = createFlagsManager();
    topLevelFlagsManager.resolve(
      new Map([
        [TOP_LEVEL_FLAGS, new Map()],
        [INHERIT_FLAGS, new Map()],
      ])
    );
    this.ROUTE_FLAGS_MAP = new Map([[FLAGS, topLevelFlagsManager]]);
    this.router.on('routeWillChange', ({ from, to, routeInfos }) => {
      const fromList = createList(from);
      const toList = createList(to);
      const { pivot } = diffRoutes({ fromList, toList });
      let routePromises = routeInfos.map((info) => info.routePromise);
      // application -> profile -> connections
      updateFlagsMapForRouteHierarchy(
        this.ROUTE_FLAGS_MAP,
        this.STORE,
        toList,
        routePromises,
        pivot
      );
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
    return this.STORE.get(key) || 'control';
  },
  getFlagIsEnabled(key) {
    return this.getFlag(key) !== 'control';
  },
  updateFlag(key) {
    const newValue = this.STORE.get(key) + 1;
    this.STORE.set(key, newValue);
  },
  setFlag(key, value) {
    this.STORE.set(key, value);
  },
  getFlagedEngine(engineMountPoint) {
    const engineConfig = this.FeatureFlags.routingFlags.mountPoints[
      engineMountPoint
    ];
    return {
      enabled: this.FeatureFlags.flags[engineConfig.key] !== 'control',
      enabledEngine: engineConfig.enabledEngine,
    };
  },
});

async function updateFlagsMapForRouteHierarchy(
  routeFlagsMap,
  store,
  toList,
  routePromises,
  pivot
) {
  // init flags map for each route hierarchy
  let initPtr = routeFlagsMap;
  for (const { localName } of toList) {
    if (!initPtr.has(localName)) {
      initPtr.set(
        localName,
        new Map([
          [PARENT, initPtr],
          [FLAGS, createFlagsManager()],
        ])
      );
    }
    initPtr = initPtr.get(localName);
  }
  // resolve the flags for routes
  let ptr = routeFlagsMap;
  for (let i = 0; i < routePromises.length; i++) {
    // TODO: figure out if we can use buildRouteInfoMetadata to get flags
    const { flags: flagEvaluator, fullRouteName } = await routePromises[i];
    console.log(`[async route resolve] resolved ${fullRouteName}`);
    const { localName } = toList[i];
    ptr = ptr.get(localName);
    if (flagEvaluator) {
      // flags.keys: ['a', 'b']
      if (!ptr.get(FLAGS).valueExists()) {
        const parentFlagsMap = ptr.get(PARENT).get(FLAGS).valueSync();
        const topLevelFlagsEntries = flagEvaluator.keys
          .filter(
            (f) =>
              !parentFlagsMap.get(TOP_LEVEL_FLAGS).has(f) &&
              !parentFlagsMap.get(INHERIT_FLAGS).has(f)
          )
          .map((f) => [f, new FlagRef(f, store.get(f))]);
        const inheritFlagsEntries = Array.from(
          parentFlagsMap.get(INHERIT_FLAGS).entries()
        ).concat(Array.from(parentFlagsMap.get(TOP_LEVEL_FLAGS).entries()));
        const flagsMapForThisLevel = new Map([
          [TOP_LEVEL_FLAGS, new Map(topLevelFlagsEntries)],
          [INHERIT_FLAGS, new Map(inheritFlagsEntries)],
        ]);
        ptr.get(FLAGS).resolve(flagsMapForThisLevel);
        FLAGS_EVALUATOR_TO_MAP.set(flagEvaluator, ptr);
        // tell evaluator snapshot can be resolved now, this is to allow using
        // async snapshot in model hooks where the async route also needs be
        // waited to init in routeWillChange
        flagEvaluator._resolve();
      }
      // update flags for routes that are below pivot
      if (i >= pivot) {
        for (const v of ptr
          .get(FLAGS)
          .valueSync()
          .get(TOP_LEVEL_FLAGS)
          .values()) {
          v.update(store.get(v._key));
        }
      }
    }
  }
}

class FlagRef {
  constructor(key, value) {
    this._key = key;
    this._cache = value;
  }
  get value() {
    return this._cache;
  }
  update(newValue) {
    this._cache = newValue;
  }
}

const PARENT = '.parent';
const FLAGS = '.flags';
const TOP_LEVEL_FLAGS = '.TOP_LEVEL_FLAGS';
const INHERIT_FLAGS = '.INHERIT_FLAGS';

const FLAGS_EVALUATOR_TO_MAP = new WeakMap();
export class FlagEvaluator {
  _resolver;
  _pending;
  _activePromiseChain;
  constructor(keys) {
    this.keys = keys;
    this._activePromiseChain = new Promise((r) => (this._resolver = r));
  }
  _snapshotSync() {
    const flagsMap = FLAGS_EVALUATOR_TO_MAP.get(this).get(FLAGS).valueSync();
    return snapshotFromFlagsMap(flagsMap, this.keys);
  }
  _resolve() {
    this._resolver();
  }
  snapshot() {
    return this._activePromiseChain.then(() =>
      FLAGS_EVALUATOR_TO_MAP.get(this)
        .get(FLAGS)
        .value()
        .then((flagsMap) => snapshotFromFlagsMap(flagsMap, this.keys))
    );
  }
}
function snapshotFromFlagsMap(flagsMap, keys) {
  const snapshot = Object.create(null);
  for (let key of keys) {
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

function createFlagsManager() {
  let pending = true;
  let v;
  let resolver;
  let activePromiseChain = new Promise((resolve) => (resolver = resolve));
  return {
    valueExists() {
      return typeof v !== 'undefined';
    },
    value() {
      if (pending === true) {
        return activePromiseChain;
      } else {
        return Promise.resolve(v);
      }
    },
    valueSync() {
      return v;
    },
    resolve(resolvedValue) {
      if (resolver) {
        resolver(resolvedValue);
      }
      pending = false;
      v = resolvedValue;
      activePromiseChain = undefined;
    },
  };
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
    const { name: toName, localName: toLocalName, params: toParams } = toList[
      i
    ];
    const {
      name: fromName,
      localName: fromLocalName,
      params: fromParams,
    } = fromList[i];
    // /profile/2 -> /profile/2/connections does not trigger model()
    if (
      (toName !== fromName &&
        toLocalName !== 'index' &&
        fromLocalName !== 'index') ||
      !objectsMatch(toParams, fromParams)
    )
      return { pivot: i };
  }
  return { pivot: toList.length };
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
