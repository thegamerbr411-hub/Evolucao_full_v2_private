describe('generated-f9df786145', () => {
  it('valida estabilidade para bug gerado por IA', async () => {
    await device.launchApp({ newInstance: true });
    await expect(element(by.id('app-root'))).toBeVisible();

    // alvo principal reportado: SmokeFlow
    await expect(element(by.id('app-root'))).toBeVisible();

    // bug de referência: qa smoke log
  });
});
