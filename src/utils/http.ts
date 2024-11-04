export function removeTrailingSlash(url: string): string {
    return url ? url.replace(/\/$/, '') : url
}
