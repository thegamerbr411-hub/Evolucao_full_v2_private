const selectors = require('./selectors/selectorRegistry');
const assertions = require('./assertions/appAssertions');
const { createAuthFlow } = require('./flows/authFlow');
const { createLogoutFlow } = require('./flows/logoutFlow');
const { createVideoFlow } = require('./flows/videoFlow');

module.exports = {
  selectors,
  assertions,
  flows: {
    authFlow: createAuthFlow,
    logoutFlow: createLogoutFlow,
    videoFlow: createVideoFlow,
  },
};