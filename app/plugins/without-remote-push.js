// The app only schedules local notifications ("storage full"), which need no
// Apple capability. expo-notifications still adds the remote-push entitlement
// (aps-environment), and the build fails unless the App ID has Push
// Notifications enabled. Remove this plugin if remote push is ever added.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutRemotePush(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
