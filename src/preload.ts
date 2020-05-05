// All of the NodeJS APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', function (ev) {
    console.log(ev)

    function replaceText(selector: string, text: string) {
        const element = document.getElementById(selector)
        if (element) {
            element.innerText = text
        }
    }

    replaceText(`chrome-version`, process.versions.chrome)
    replaceText(`node-version`, process.versions.node)
    replaceText(`electron-version`, process.versions.electron)
})