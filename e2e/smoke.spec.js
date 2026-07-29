import { test, expect } from '@playwright/test'
import { waitForPageReady } from './helpers/layout-audit'

/**
 * Guards the responsive suite against passing vacuously.
 *
 * Every layout assertion is trivially true on a blank page, so each route must
 * first be shown to render real fixture data — not an empty state, not a
 * redirect to the login screen.
 */

test.use({ viewport: { width: 375, height: 812 } })

const CASES = [
    { path: '#/dashboard', title: 'ダッシュボード', mustSee: ['今後のイベント', '登録顧客数'] },
    { path: '#/shifts', title: 'シフト管理', mustSee: ['候補日提案', '出欠入力'] },
    { path: '#/customers', title: '顧客データベース', mustSee: ['ほしぞらさん', 'みかづき'] },
    { path: '#/feedbacks', title: '感想・接客記録', mustSee: ['あかり', 'ほしぞらさん'] },
    { path: '#/gallery', title: 'ギャラリー', mustSee: ['イベント'] },
    { path: '#/ideas', title: 'イベントタイトル アイデア', mustSee: ['夏の夜の星空バーイベント'] },
    { path: '#/events', title: 'イベントカレンダー', mustSee: ['Join', 'ReqIn'] },
    { path: '#/settings', title: '設定', mustSee: ['招待URL', 'プロフィール'] },
]

for (const { path, title, mustSee } of CASES) {
    test(`${title} がフィクスチャの実データを描画している`, async ({ page }) => {
        await page.goto(path)
        await waitForPageReady(page)

        // Not bounced to the login screen
        await expect(page.locator('.login-card')).toHaveCount(0)
        await expect(page.locator('.page-title')).toContainText(title)

        for (const text of mustSee) {
            // `visible=true` matters: pages keep a desktop-only table in the DOM
            // with display:none, and .first() would otherwise resolve to that.
            await expect(
                page.getByText(text, { exact: false }).locator('visible=true').first(),
                `"${text}" が描画されていません（空ページに対してレイアウト検証が素通りします）`
            ).toBeVisible()
        }
    })
}

test('シフト管理: 出欠入力タブがモバイルでカード表示に切り替わる', async ({ page }) => {
    await page.goto('#/shifts')
    await waitForPageReady(page)
    await page.getByRole('button', { name: /出欠入力/ }).click()

    // The wide table is the desktop view and must be hidden here.
    await expect(page.locator('.vote-table')).toBeHidden()
    await expect(page.locator('.vote-cards .vote-card').first()).toBeVisible()
    expect(await page.locator('.vote-cards .vote-card').count()).toBeGreaterThan(0)
})

test('顧客データベース: モバイルではテーブルではなくカードを表示する', async ({ page }) => {
    await page.goto('#/customers')
    await waitForPageReady(page)

    await expect(page.locator('.customer-table')).toBeHidden()
    await expect(page.locator('.customer-cards .customer-card').first()).toBeVisible()
})

test('イベント登録モーダルが全幅のボトムシートとして開く', async ({ page }) => {
    await page.goto('#/events')
    await waitForPageReady(page)
    await page.getByRole('button', { name: /新規登録/ }).click()

    const modal = page.locator('.modal')
    await expect(modal).toBeVisible()

    const box = await modal.boundingBox()
    const viewport = page.viewportSize()
    expect(box.width, 'モバイルではシートが全幅になるはず').toBeCloseTo(viewport.width, 0)

    const radii = await modal.evaluate(el => {
        const cs = getComputedStyle(el)
        return { top: cs.borderTopLeftRadius, bottom: cs.borderBottomLeftRadius }
    })
    expect(radii.bottom, '下端は角丸なしで画面下に密着する').toBe('0px')
    expect(radii.top).not.toBe('0px')
})

test('モーダルを開くと背面がスクロールしない', async ({ page }) => {
    await page.goto('#/events')
    await waitForPageReady(page)

    await page.getByRole('button', { name: /新規登録/ }).click()
    await expect(page.locator('.modal')).toBeVisible()

    const locked = await page.evaluate(() => getComputedStyle(document.body).position)
    expect(locked, 'モーダル表示中は body が固定されるはず').toBe('fixed')

    await page.getByRole('button', { name: 'キャンセル' }).click()
    await expect(page.locator('.modal')).toHaveCount(0)

    const released = await page.evaluate(() => getComputedStyle(document.body).position)
    expect(released, 'モーダルを閉じたら固定が解除されるはず').toBe('static')
})
