await Bun.build({
    entrypoints: ['./index.js'],
    outdir: './dist',
    target: 'browser',
    minify: true,
})