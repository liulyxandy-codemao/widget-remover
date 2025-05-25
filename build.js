await Bun.build({
    entrypoints: ['./index.js'],
    outdir: './dist',
    target: 'browser',
    minify: true,
})

const dist = Bun.file('./dist/index.js')
const head = Bun.file('./head.js')

dist.write(await head.text() + await dist.text())