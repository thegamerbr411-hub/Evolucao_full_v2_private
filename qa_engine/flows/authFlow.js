const { screens, elements } = require('../selectors/selectorRegistry');

function createAuthFlow() {
  return {
    name: 'authFlow',
    targetScreen: screens.login,
    steps: [
      { action: 'waitForScreen', selector: screens.login },
      { action: 'type', selector: elements.inputEmail },
      { action: 'type', selector: elements.inputPassword },
      { action: 'tap', selector: elements.btnLogin },
      { action: 'waitForScreen', selector: screens.home },
    ],
  };
}

module.exports = { createAuthFlow };