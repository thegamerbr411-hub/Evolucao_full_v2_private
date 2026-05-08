const { screens, elements } = require('../selectors/selectorRegistry');

function createLogoutFlow() {
  return {
    name: 'logoutFlow',
    targetScreen: screens.profile,
    steps: [
      { action: 'waitForScreen', selector: screens.profile },
      { action: 'tap', selector: elements.btnLogout },
      { action: 'waitForScreen', selector: screens.register },
    ],
  };
}

module.exports = { createLogoutFlow };