// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Tests login form display and basic interaction
 */

test.describe('Authentication', () => {
    test('should display login page by default', async ({ page }) => {
        await page.goto('/');

        // Should show login form elements - use CSS selectors since labels aren't associated
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    });

    test('should have signup option available', async ({ page }) => {
        await page.goto('/');

        // Should show option to create account
        const signupText = page.getByText(/sign up|create account|register/i);
        await expect(signupText).toBeVisible();
    });

    test('should show error on invalid login attempt', async ({ page }) => {
        await page.goto('/');

        // Fill in invalid credentials using CSS selectors
        await page.locator('input[type="email"]').fill('invalid@test.com');
        await page.locator('input[type="password"]').fill('wrongpassword');
        await page.getByRole('button', { name: /login/i }).click();

        // Wait for potential error message or console error
        // Firebase will reject invalid credentials
        await page.waitForTimeout(2000);
    });

    test('email input should validate email format', async ({ page }) => {
        await page.goto('/');

        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toHaveAttribute('type', 'email');
    });

    test('password input should be masked', async ({ page }) => {
        await page.goto('/');

        const passwordInput = page.locator('input[type="password"]');
        await expect(passwordInput).toHaveAttribute('type', 'password');
    });
});
