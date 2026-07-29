import { useEffect } from 'react'

/**
 * Number of components currently requesting a lock. Reference counting keeps
 * a modal opened on top of the sidebar from releasing the lock too early.
 * @type {number}
 */
let lockCount = 0

/** Scroll offset captured when the first lock was acquired. */
let savedScrollY = 0

function acquireLock() {
    lockCount += 1
    if (lockCount > 1) return

    savedScrollY = window.scrollY
    const { body } = document

    // position:fixed (rather than overflow:hidden alone) is what actually
    // stops iOS Safari from rubber-band scrolling the page behind an overlay.
    body.style.position = 'fixed'
    body.style.top = `-${savedScrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.classList.add('is-scroll-locked')
}

function releaseLock() {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return

    const { body } = document
    body.style.position = ''
    body.style.top = ''
    body.style.left = ''
    body.style.right = ''
    body.style.width = ''
    body.classList.remove('is-scroll-locked')

    // Restore the position the user was reading before the overlay opened.
    window.scrollTo(0, savedScrollY)
}

/**
 * Freezes background page scrolling while an overlay is open.
 *
 * @param {boolean} isLocked Whether scrolling should currently be frozen.
 * @returns {void}
 */
export function useBodyScrollLock(isLocked) {
    useEffect(() => {
        if (!isLocked) return undefined

        acquireLock()
        return releaseLock
    }, [isLocked])
}

export default useBodyScrollLock
