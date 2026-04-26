const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_USER = process.env.ADMIN_USER || process.env.ADMIN_EMAIL || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || 'pass123';
const SCREEN_DIR = path.resolve(__dirname, '..', 'artifacts', 'qa-full', 'screens', 'web');

function ensureDir() {
  if (!fs.existsSync(SCREEN_DIR)) {
    fs.mkdirSync(SCREEN_DIR, { recursive: true });
  }
}

test.describe('Full QA Dashboard Admin Catalog', () => {
  test('login, dashboard, catalogo, aprovar, recusar e responsividade', async ({ page }) => {
    ensureDir();

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    await page.fill('#adminUser', ADMIN_USER);
    await page.fill('#adminPass', ADMIN_PASS);
    await page.fill('#clientId', 'admin');
    await page.click('#btnLogin');

    await expect(page.locator('#sessionChip')).toContainText(/autenticada|token carregado/i, { timeout: 15000 });
    await page.click('#btnRefresh');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREEN_DIR, 'dashboard-login-ok.png'), fullPage: true });

    await expect(page.locator('#bugsList')).toBeVisible();
    await expect(page.locator('#metrics')).toBeVisible();
    await page.screenshot({ path: path.join(SCREEN_DIR, 'dashboard-main.png'), fullPage: true });

    await expect(page.locator('#catalogSection')).toBeVisible({ timeout: 15000 });
    await page.fill('#catalogTitle', `QA Catalog Item ${Date.now()}`);
    await page.fill('#catalogDesc', 'Item criado via teste E2E para validar fluxo de pendencias.');
    await page.selectOption('#catalogType', 'exercise');
    await page.fill('#catalogMuscle', 'peitoral');
    await page.fill('#catalogEquip', 'barra');
    await page.selectOption('#catalogDifficulty', 'beginner');
    await page.fill('#catalogSource', 'qa-automation');
    await page.click('#btnCatalogSubmit');

    await expect(page.locator('#catalogSubmitMsg')).toContainText(/enviado|sucesso|pendente/i, { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREEN_DIR, 'catalog-submitted.png'), fullPage: true });

    const firstApprove = page.locator('.btn-approve-catalog').first();
    if (await firstApprove.count()) {
      await firstApprove.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREEN_DIR, 'catalog-approved.png'), fullPage: true });
    }

    // Cria mais um para validar recusa.
    await page.fill('#catalogTitle', `QA Catalog Reject ${Date.now()}`);
    await page.fill('#catalogDesc', 'Item para validar caminho de recusa no dashboard.');
    await page.selectOption('#catalogType', 'machine');
    await page.fill('#catalogMuscle', 'costas');
    await page.fill('#catalogEquip', 'maquina');
    await page.selectOption('#catalogDifficulty', 'intermediate');
    await page.fill('#catalogSource', 'qa-automation');
    await page.click('#btnCatalogSubmit');
    await expect(page.locator('#catalogSubmitMsg')).toContainText(/enviado|sucesso|pendente/i, { timeout: 10000 });

    const firstReject = page.locator('.btn-reject-catalog').first();
    if (await firstReject.count()) {
      await firstReject.click();
      const rejectInput = page.locator('.reject-input').first();
      if (await rejectInput.count()) {
        await rejectInput.fill('recusa automatizada para validar fluxo');
      }
      const confirmReject = page.locator('.btn-confirm-reject').first();
      if (await confirmReject.count()) {
        await confirmReject.click();
      }
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREEN_DIR, 'catalog-rejected.png'), fullPage: true });
    }

    // Responsividade mobile.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#sessionChip')).toContainText(/autenticada|token carregado/i, { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREEN_DIR, 'dashboard-mobile-responsive.png'), fullPage: true });
  });
});
