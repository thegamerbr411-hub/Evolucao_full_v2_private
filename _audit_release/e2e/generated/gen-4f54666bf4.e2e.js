describe('generated-4f54666bf4', () => {
  it('valida estabilidade para bug gerado por IA', async () => {
    await device.launchApp({ newInstance: true });
    await expect(element(by.id('app-root'))).toBeVisible();

    // alvo principal reportado: Home
    await expect(element(by.id('app-root'))).toBeVisible();

    // bug de referência: Network error 500
  });
});
