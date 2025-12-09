// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Events E2E Tests
 * Tests event-related UI elements
 */

test.describe('Events UI', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('app should be responsive', async ({ page }) => {
        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        const loginButton = page.getByRole('button', { name: /login/i });
        await expect(loginButton).toBeVisible();
    });

    test('app should work on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/');

        const loginButton = page.getByRole('button', { name: /login/i });
        await expect(loginButton).toBeVisible();
    });

    test('app should work on desktop viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/');

        const loginButton = page.getByRole('button', { name: /login/i });
        await expect(loginButton).toBeVisible();
    });
});

test.describe('Form Interactions', () => {
    test('login form should accept keyboard input', async ({ page }) => {
        await page.goto('/');

        // Use CSS selector instead of getByLabel
        const emailInput = page.locator('input[type="email"]');
        await emailInput.click();
        await emailInput.fill('test@example.com');

        await expect(emailInput).toHaveValue('test@example.com');
    });

    test('should be able to tab through form fields', async ({ page }) => {
        await page.goto('/');

        // Focus email input using CSS selector
        await page.locator('input[type="email"]').focus();

        // Tab to next field
        await page.keyboard.press('Tab');

        // Password should be focused
        const passwordInput = page.locator('input[type="password"]');
        await expect(passwordInput).toBeFocused();
    });
});
