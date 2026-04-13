// playwright-dashboard.spec.js
// Testes E2E do dashboard QA com Playwright
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_USER = process.env.ADMIN_USER || process.env.ADMIN_EMAIL || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || '123456';

async function loginWithFallback(request) {
  const candidates = [
    { user: ADMIN_USER, pass: ADMIN_PASS },
    { user: process.env.ADMIN_EMAIL || 'admin@teste.com', pass: ADMIN_PASS },
    { user: 'admin', pass: '123456' },
    { user: 'admin', pass: 'pass123' },
  ];

  for (const candidate of candidates) {
    const loginRes = await request.post(`${BASE_URL}/login`, {
      data: candidate,
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginRes.ok()) {
      const loginJson = await loginRes.json();
      if (loginJson?.token) {
        return loginJson;
      }
    }
  }

  throw new Error('playwright_login_failed_all_candidates');
}

test.describe('Dashboard QA - Fluxo Principal', () => {
  test('Login admin e dashboard', async ({ page, request }) => {
      // 1. Login via API
      const loginJson = await loginWithFallback(request);
      expect(loginJson).toHaveProperty('token');

      // 2. Salva token no localStorage antes de abrir a página
      await page.goto(`${BASE_URL}/`);
      await page.evaluate((token) => {
        localStorage.setItem('qa_admin_v2', token);
        localStorage.setItem('qa_client_token_v2', token);
        localStorage.setItem('qa_client_id_v2', 'admin');
      }, loginJson.token);

      // 3. Recarrega página já autenticada
      await page.reload();

      // 4. Valida UI já autenticada
      await expect(page.locator('#sessionChip')).toHaveText(/autenticada|token carregado/i, { timeout: 10000 });
      // Valida que o painel mostra bugs
      const bugList = page.locator('.list .item');
      await expect.poll(async () => await bugList.count(), { timeout: 10000 }).toBeGreaterThan(0);
      // Valida que o chip de cliente está correto
      await expect(page.locator('#clientChip')).toContainText('Cliente: admin');
    });
});
