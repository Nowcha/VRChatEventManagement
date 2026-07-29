/**
 * Layout assertions that run inside the page.
 *
 * These encode the three classes of bug found during the mobile pass:
 *   1. content wider than the viewport (the 320px modal overflow)
 *   2. form fields under 16px, which makes iOS Safari zoom on focus
 *   3. tap targets too small to hit reliably
 */

/** Elements that are *supposed* to scroll sideways, plus their descendants. */
const SCROLLABLE = ['.time-grid', '.table-container', '.tab-bar', 'select', 'option']

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{
 *   documentOverflow: { scrollWidth: number, clientWidth: number, overflows: boolean },
 *   overflowingElements: string[],
 *   zoomTriggeringFields: { selector: string, fontSize: number }[],
 *   smallTapTargets: { selector: string, width: number, height: number }[]
 * }>}
 */
export async function auditLayout(page) {
    return page.evaluate((scrollable) => {
        const de = document.documentElement
        const viewport = de.clientWidth

        const describe = (el) => {
            const cls = typeof el.className === 'string' && el.className
                ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
                : ''
            const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)
            return `${el.tagName.toLowerCase()}${cls}${text ? ` "${text}"` : ''}`
        }

        const isInsideScroller = (el) => scrollable.some(sel => el.closest(sel))

        const all = [...document.querySelectorAll('body *')]

        const overflowingElements = all
            .filter(el => {
                if (isInsideScroller(el)) return false
                const r = el.getBoundingClientRect()
                if (r.width === 0 || r.height === 0) return false
                // Ignore off-screen drawers/overlays parked outside the viewport.
                const cs = getComputedStyle(el)
                if (cs.visibility === 'hidden' || cs.display === 'none') return false
                if (el.closest('.sidebar:not(.open)')) return false
                return r.right > viewport + 1 || r.left < -1
            })
            .map(el => `${describe(el)} [${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}] vw=${viewport}`)

        const zoomTriggeringFields = [...document.querySelectorAll('input, select, textarea')]
            .filter(el => {
                const t = (el.getAttribute('type') || '').toLowerCase()
                // Checkboxes/radios/files don't focus a text field, so no zoom.
                if (['checkbox', 'radio', 'file', 'hidden', 'range', 'color'].includes(t)) return false
                return el.offsetParent !== null && parseFloat(getComputedStyle(el).fontSize) < 16
            })
            .map(el => ({ selector: describe(el), fontSize: parseFloat(getComputedStyle(el).fontSize) }))

        const smallTapTargets = [...document.querySelectorAll('button, a[href], [role="button"], .btn')]
            .filter(el => {
                const r = el.getBoundingClientRect()
                if (r.width === 0 || r.height === 0) return false
                if (el.closest('.sidebar:not(.open)')) return false
                // 32px is the floor we actually hold to; 44px is the goal but
                // some dense inline controls (emoji reactions) sit just below.
                return r.height < 32 || r.width < 24
            })
            .map(el => {
                const r = el.getBoundingClientRect()
                return { selector: describe(el), width: Math.round(r.width), height: Math.round(r.height) }
            })

        return {
            documentOverflow: {
                scrollWidth: de.scrollWidth,
                clientWidth: viewport,
                overflows: de.scrollWidth > viewport,
            },
            overflowingElements,
            zoomTriggeringFields,
            smallTapTargets,
        }
    }, SCROLLABLE)
}

/**
 * Kills transitions and animations so geometry is measured at its final
 * values. Without this, the sidebar drawer is still sliding in from
 * translateX(-100%) when the audit runs and reports a false overflow.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function freezeAnimations(page) {
    await page.addStyleTag({
        content: `*, *::before, *::after {
            transition: none !important;
            animation: none !important;
        }`,
    })
}

/**
 * Waits until the page has finished its initial Firestore render.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForPageReady(page) {
    await page.waitForSelector('.page-title, .login-card', { timeout: 15_000 })
    await page.waitForFunction(() => !document.querySelector('.loading-spinner'), null, { timeout: 15_000 })
    await freezeAnimations(page)
}
