const { screens, elements } = require('../selectors/selectorRegistry');

function createVideoFlow() {
  return {
    name: 'videoFlow',
    targetScreen: screens.exerciseDetail,
    steps: [
      { action: 'waitForScreen', selector: screens.exerciseDetail },
      { action: 'tap', selector: elements.btnOpenVideoExternal },
      { action: 'tap', selector: elements.btnEnablePlayer },
      { action: 'assert', selector: elements.playerInternal },
      { action: 'tap', selector: elements.btnPlayerFullscreen },
    ],
  };
}

module.exports = { createVideoFlow };