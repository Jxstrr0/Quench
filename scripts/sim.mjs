// npm run sim: bot smiths make every pattern in every steel, many ways, and the
// balance of the game is read off the results (src/sim/bots.ts does the work).
//
//   npm run sim                      every pattern, every steel (a few minutes)
//   npm run sim -- cleaver           one pattern (or several)
//   npm run sim -- cleaver 1084 W2   one pattern in two steels
//
// It ends with an error if a balance check fails, so it can gate a tuning change.
import { fork } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const SELF = fileURLToPath(import.meta.url)
const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Load the game's TypeScript through Vite, with none of the app's own build set-up. */
async function load() {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, ws: false, hmr: false, watch: null },
  })
  const [bots, patterns, steels, data] = await Promise.all([
    server.ssrLoadModule('/src/sim/bots.ts'),
    server.ssrLoadModule('/src/data/patterns.ts'),
    server.ssrLoadModule('/src/data/steels.ts'),
    server.ssrLoadModule('/src/data/bots.ts'),
  ])
  return { server, bots, patterns, steels, data }
}

if (process.argv.includes('--worker')) {
  // A worker makes the cells it is sent, one at a time.
  const { server, bots } = await load()
  process.on('message', async (job) => {
    if (job === 'done') {
      await server.close()
      process.exit(0)
    }
    process.send({ index: job.index, cell: bots.cellFor(job.pattern, job.steel) })
  })
  process.send('ready')
} else {
  const { server, bots, patterns, steels, data } = await load()
  const asked = process.argv.slice(2)
  const unknown = asked.filter((a) => !(a in patterns.PATTERNS) && !(a in steels.STEELS))
  if (unknown.length) {
    console.error(`sim: not a pattern or a steel: ${unknown.join(', ')}`)
    console.error(`patterns: ${Object.keys(patterns.PATTERNS).join(', ')}`)
    console.error(`steels: ${steels.STEEL_ORDER.join(', ')}`)
    process.exit(2)
  }
  const wantPatterns = Object.keys(patterns.PATTERNS).filter((p) => asked.includes(p))
  const wantSteels = steels.STEEL_ORDER.filter((s) => asked.includes(s))
  const patternIds = wantPatterns.length ? wantPatterns : Object.keys(patterns.PATTERNS)
  const steelIds = wantSteels.length ? wantSteels : steels.STEEL_ORDER

  const jobs = []
  for (const pattern of patternIds) for (const steel of steelIds) jobs.push({ index: jobs.length, pattern, steel })
  const cells = new Array(jobs.length)
  // The longest blades take the longest: hand those out first.
  const queue = [...jobs].sort((a, b) => patterns.PATTERNS[b.pattern].stock.length - patterns.PATTERNS[a.pattern].stock.length)
  const started = Date.now()
  let finished = 0

  await new Promise((resolve, reject) => {
    const count = Math.min(availableParallelism(), jobs.length)
    let live = count
    for (let n = 0; n < count; n++) {
      const child = fork(SELF, ['--worker'])
      const next = () => {
        const job = queue.shift()
        if (job) child.send(job)
        else child.send('done')
      }
      child.on('message', (m) => {
        if (m !== 'ready') {
          cells[m.index] = m.cell
          finished++
          process.stderr.write(`\r${finished} of ${jobs.length} done`)
        }
        next()
      })
      child.on('exit', (code) => {
        if (code) reject(new Error(`sim: a worker stopped with code ${code}`))
        if (--live === 0) resolve()
      })
    }
  })
  process.stderr.write('\r' + ' '.repeat(40) + '\r')

  const ways = bots.gridWays().length
  const media = data.GRID.medium
  const careless = Object.keys(data.CARELESS)
  const pad = (v, n) => String(v).padStart(n)
  const out = []
  out.push('Quench balance: bot smiths')
  out.push(`${patternIds.length} patterns x ${steelIds.length} steels. The careful smith tries ${ways} ways on ${data.GRID.seeds.length} bars each and keeps the best.`)
  out.push('Scores are out of 100, as the daily commission counts them. "sound" is the share of the ways that pass every test on every bar.')

  for (const pattern of patternIds) {
    const row = cells.filter((c) => c.pattern === pattern)
    out.push('')
    out.push(`${pattern} (${patterns.PATTERNS[pattern].trials.join(', ')})`)
    out.push(`  ${'steel'.padEnd(7)} best  ${'the careful way'.padEnd(30)} sound | best with each quench: ${media.join(' ')}`)
    for (const c of row) {
      const w = c.best.way
      const how = `${w.medium}, ${w.temper} C, ${w.thin} mm, ${w.angle} deg`
      const flaw = c.best.passedAll < 1 ? `  fails: ${c.best.failed.join(', ')}` : ''
      out.push(`  ${c.steel.padEnd(7)} ${pad(Math.round(c.best.score), 4)}  ${how.padEnd(30)} ${pad(Math.round(c.forgiving * 100), 4)}% | ${media.map((m) => pad(Math.round(c.byChoice.medium[m]), m.length)).join(' ')}${flaw}`)
    }
    out.push(`  ${'careless'.padEnd(7)} ${careless.map((w) => pad(w, 10)).join(' ')}`)
    for (const c of row) out.push(`  ${c.steel.padEnd(7)} ${careless.map((w) => pad(`${Math.round(c.careless[w].score)}${c.careless[w].passedAll === 1 ? ' pass' : ''}`, 10)).join(' ')}`)
  }

  const TITLE = {
    steel: 'No steel always wins',
    medium: 'No quench always wins',
    temper: 'No tempering heat always wins (degrees C)',
    thin: 'No edge thickness always wins (mm behind the edge)',
    angle: 'No sharpening angle always wins (degrees each side)',
    careless: 'Careless work reliably fails',
    makeable: 'Every pattern can be made to pass',
  }
  const found = bots.findings(cells)
  for (const f of found) {
    out.push('')
    out.push(`${TITLE[f.id]}: ${f.ok ? 'yes' : 'NO'}`)
    for (const line of f.detail) out.push(`  ${line}`)
  }
  out.push('')
  out.push(`${jobs.length} pattern and steel pairs in ${Math.round((Date.now() - started) / 1000)} s.`)
  console.log(out.join('\n'))
  await server.close()
  process.exit(found.every((f) => f.ok) ? 0 : 1)
}
