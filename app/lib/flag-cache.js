export const FeatureFlags = Object.freeze({
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
export const STORE = new Map(Object.entries(FeatureFlags.flags));
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
