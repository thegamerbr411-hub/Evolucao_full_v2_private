describe('generated-7ab64029f9', () => {
  it('valida estabilidade para bug gerado por IA', async () => {
    await device.launchApp({ newInstance: true });
    await expect(element(by.id('app-root'))).toBeVisible();

    // alvo principal reportado: smoke-screen
    await expect(element(by.id('app-root'))).toBeVisible();

    // bug de referência: smoke network error
  });
});
