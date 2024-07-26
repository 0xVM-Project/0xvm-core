export function removeTrailingSlash(url: string | undefined): string {
    return url ? url.replace(/\/$/, '') : url
}
