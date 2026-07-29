/** Stand-in for `firebase/storage` in the `e2e` Vite mode. */
export function getStorage() {
    return { __storage: true }
}

export function ref(_storage, path) {
    return { path }
}

export async function uploadBytes(reference) {
    return { ref: reference }
}

export async function getDownloadURL() {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23ddd"/></svg>'
}

export async function deleteObject() {
    return undefined
}
