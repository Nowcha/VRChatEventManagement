import { test, expect } from '@playwright/test'
import { auditLayout, waitForPageReady } from './helpers/layout-audit'

const ROUTES = [
    { path: '#/dashboard', name: 'ダッシュボード' },
    { path: '#/shifts', name: 'シフト管理' },
    { path: '#/customers', name: '顧客データベース' },
    { path: '#/feedbacks', name: '感想・接客記録' },
    { path: '#/gallery', name: 'ギャラリー' },
    { path: '#/ideas', name: 'タイトルアイデア' },
    { path: '#/events', name: 'イベントカレンダー' },
    { path: '#/settings', name: '設定' },
]

const VIEWPORTS = [
    { label: '320x568 (小型スマホ)', width: 320, height: 568, mobile: true },
    { label: '375x812 (iPhone相当)', width: 375, height: 812, mobile: true },
    { label: '768x1024 (タブレット縦)', width: 768, height: 1024, mobile: true },
    { label: '1280x800 (デスクトップ)', width: 1280, height: 800, mobile: false },
]

/**
 * Overlay states. Page-load audits miss these entirely — the 320px overflow in
 * the event form only existed once the modal was open.
 */
const OVERLAYS = [
    { path: '#/events', name: 'イベント登録モーダル', open: /新規登録/, wait: '.modal' },
    { path: '#/customers', name: '顧客登録モーダル', open: /顧客登録/, wait: '.modal' },
    { path: '#/feedbacks', name: '感想入力モーダル', open: /感想入力/, wait: '.modal' },
    { path: '#/dashboard', name: 'サイドバードロワー', open: null, wait: '.sidebar.open' },
]

for (const viewport of VIEWPORTS) {
    test.describe(viewport.label, () => {
        test.use({ viewport: { width: viewport.width, height: viewport.height } })

        for (const overlay of OVERLAYS) {
            test(`${overlay.name} が横にはみ出さない`, async ({ page }) => {
                await page.goto(overlay.path)
                await waitForPageReady(page)

                if (overlay.open) {
                    await page.getByRole('button', { name: overlay.open }).first().click()
                } else {
                    // The drawer toggle only exists below the desktop breakpoint.
                    const toggle = page.locator('.menu-toggle')
                    if (!(await toggle.isVisible())) test.skip()
                    await toggle.click()
                }
                await page.waitForSelector(overlay.wait, { state: 'visible' })

                const audit = await auditLayout(page)

                expect(
                    audit.overflowingElements,
                    `ビューポート(${audit.documentOverflow.clientWidth}px)からはみ出す要素:\n` +
                    audit.overflowingElements.join('\n')
                ).toEqual([])

                if (viewport.mobile) {
                    expect(
                        audit.zoomTriggeringFields,
                        'iOS Safari は 16px 未満の入力欄にフォーカスするとページを拡大します:\n' +
                        audit.zoomTriggeringFields.map(f => `  ${f.selector} = ${f.fontSize}px`).join('\n')
                    ).toEqual([])
                }
            })
        }

        for (const route of ROUTES) {
            test(`${route.name} が横にはみ出さない`, async ({ page }) => {
                await page.goto(route.path)
                await waitForPageReady(page)

                const audit = await auditLayout(page)

                expect(
                    audit.overflowingElements,
                    `ビューポート(${audit.documentOverflow.clientWidth}px)からはみ出す要素:\n` +
                    audit.overflowingElements.join('\n')
                ).toEqual([])

                expect(
                    audit.documentOverflow.overflows,
                    `ページ全体が横スクロールしています ` +
                    `(scrollWidth=${audit.documentOverflow.scrollWidth}, clientWidth=${audit.documentOverflow.clientWidth})`
                ).toBe(false)
            })

            if (viewport.mobile) {
                test(`${route.name} の入力欄が iOS のズームを誘発しない`, async ({ page }) => {
                    await page.goto(route.path)
                    await waitForPageReady(page)

                    const { zoomTriggeringFields } = await auditLayout(page)

                    expect(
                        zoomTriggeringFields,
                        'iOS Safari は 16px 未満の入力欄にフォーカスするとページを拡大します:\n' +
                        zoomTriggeringFields.map(f => `  ${f.selector} = ${f.fontSize}px`).join('\n')
                    ).toEqual([])
                })

                test(`${route.name} のタップ領域が十分に大きい`, async ({ page }) => {
                    await page.goto(route.path)
                    await waitForPageReady(page)

                    const { smallTapTargets } = await auditLayout(page)

                    expect(
                        smallTapTargets,
                        '高さ32px未満 / 幅24px未満の操作要素:\n' +
                        smallTapTargets.map(t => `  ${t.selector} = ${t.width}x${t.height}`).join('\n')
                    ).toEqual([])
                })
            }
        }
    })
}
