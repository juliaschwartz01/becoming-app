// Turns Vite's dist-artifact/index.html into the page body claude.ai publishes.
// claude.ai wraps the page in its own <!doctype><html><head><body> skeleton, so we keep
// only the title, stylesheets, preloads and the app's module script.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const dir = 'dist-artifact'
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
const keep = [...head.matchAll(/<(?:link[^>]*rel="(?:stylesheet|modulepreload)"[^>]*|script[^>]*type="module"[^>]*)>(?:<\/script>)?/g)].map((m) => m[0].includes('<script') && !m[0].endsWith('</script>') ? m[0] + '</script>' : m[0])
const page = `<title>Becoming</title>
<style>html,body{background:#fbf8f3}</style>
${keep.join('\n')}
<div id="root"></div>
`
writeFileSync(join(dir, 'page.html'), page)

// claude.ai rejects text files containing raw control characters. Minified libraries keep a few
// inside string and regex literals; rewrite them as \xNN escapes (identical meaning there).
const escapeControls = (p) => {
  const src = readFileSync(p, 'latin1')
  // \t \n \r and the whitespace characters \v \f stay as they are.
  const out = src.replace(/[\x00-\x08\x0e-\x1f\x7f]/g, (c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
  if (out !== src) { writeFileSync(p, out, 'latin1'); console.log('escaped control characters in', p) }
}

// List every published file for the Artifact tool's `files` map.
const files = {}
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f)
  if (statSync(p).isDirectory()) return walk(p)
  const rel = relative(dir, p)
  if (rel === 'index.html' || rel === 'page.html' || rel === 'files.json') return
  if (/\.(m?js|css)$/.test(rel)) escapeControls(p)
  files[rel] = p
})
walk(dir)
writeFileSync(join(dir, 'files.json'), JSON.stringify(files, null, 2))
console.log(`page.html written; ${Object.keys(files).length} files to publish`)
