// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Groups E2E Tests
 * Tests group creation and management UI
 * Note: These tests check UI elements when authenticated
 */

test.describe('Groups UI', () => {
    // Skip auth-required tests if not logged in
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should show login form when not authenticated', async ({ page }) => {
        // When not logged in, should see login form
        await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    });

    test('page should load without JavaScript errors', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        await page.goto('/');
        await page.waitForTimeout(1000);

        // Filter out expected Firebase errors for unauthenticated state
        const criticalErrors = errors.filter(e =>
            !e.includes('Firebase') &&
            !e.includes('auth')
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test('should have proper page title', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/group|activity|planner/i);
    });
});

test.describe('Group Creation Modal', () => {
    // These would run after authentication
    // For now, just verify the app renders correctly

    test('app should render main container', async ({ page }) => {
        await page.goto('/');

        // Verify the app container is present
        const appContainer = page.locator('#root');
        await expect(appContainer).toBeVisible();
    });
});
