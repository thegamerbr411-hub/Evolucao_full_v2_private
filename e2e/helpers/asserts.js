const expectVisible = async (id) => {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(5000);
};

const expectNotVisible = async (id) => {
  await waitFor(element(by.id(id))).toBeNotVisible().withTimeout(3000);
};

const expectText = async (id, text) => {
  await waitFor(element(by.id(id))).toHaveText(text).withTimeout(5000);
};

module.exports = {
  expectVisible,
  expectNotVisible,
  expectText,
};
