import { describe, expect, it } from 'vitest'
import { beltVoice, cuesDue, fireVoice, hammerVoice, placeCue, seaVoice, sparkRate, strokeVoice, trialCues } from '../src/audio/cues'
import { FORGE_SOUNDS, SPARK_SOUND, TRIAL_SOUNDS } from '../src/data/audio'

describe('the sound of a blow', () => {
  it('hot, thick steel gives a dull thud with no ring', () => {
    const v = hammerVoice(1100, 8, 1)
    expect(v.thud).toBe(1)
    expect(v.ring).toBe(0)
  })
  it('cold, thin steel rings long and high', () => {
    const cold = hammerVoice(20, 2, 1)
    const warm = hammerVoice(800, 6, 1)
    expect(cold.ring).toBe(1)
    expect(cold.ring).toBeGreaterThan(warm.ring)
    expect(cold.ringHz).toBeGreaterThan(warm.ringHz)
    expect(cold.ringSeconds).toBeGreaterThan(warm.ringSeconds)
    expect(cold.thud).toBeLessThan(warm.thud)
  })
  it('thin steel rings more than thick steel at the same heat', () => {
    expect(hammerVoice(600, 3, 1).ring).toBeGreaterThan(hammerVoice(600, 7, 1).ring)
  })
  it('a harder blow is louder, and every value stays in range', () => {
    expect(hammerVoice(900, 5, 1).gain).toBeGreaterThan(hammerVoice(900, 5, 0.3).gain)
    for (const temp of [-50, 20, 500, 900, 1500]) {
      for (const thickness of [0.5, 3, 12]) {
        const v = hammerVoice(temp, thickness, 2)
        for (const n of [v.gain, v.thud, v.ring]) {
          expect(n).toBeGreaterThanOrEqual(0)
          expect(n).toBeLessThanOrEqual(1)
        }
        expect(v.ringHz).toBeGreaterThan(0)
        expect(v.ringSeconds).toBeGreaterThan(0)
      }
    }
  })
})

describe('the sound of the belt', () => {
  it('runs quietly when free and louder and brighter with steel pressed to it', () => {
    const free = beltVoice(0)
    const light = beltVoice(0.35)
    const hard = beltVoice(1)
    expect(free.gain).toBeGreaterThan(0)
    expect(light.gain).toBeGreaterThan(free.gain)
    expect(hard.gain).toBeGreaterThan(light.gain)
    expect(hard.hz).toBeGreaterThan(free.hz)
    expect(beltVoice(5)).toEqual(hard)
    expect(beltVoice(-1)).toEqual(free)
  })
})

describe('the sound of the stone', () => {
  it('a firm stroke is louder than a light one, and both are short', () => {
    const light = strokeVoice(0.35)
    const firm = strokeVoice(1)
    expect(light.gain).toBeGreaterThan(0)
    expect(firm.gain).toBeGreaterThan(light.gain)
    expect(firm.seconds).toBeLessThan(0.5)
    expect(strokeVoice(9)).toEqual(firm)
  })
})

describe('the sound of the fire', () => {
  it('is never silent, and roars louder, brighter and rougher with the bellows', () => {
    const idle = fireVoice(0, false, false)
    const full = fireVoice(1, false, false)
    expect(idle.gain).toBeGreaterThan(0)
    expect(full.gain).toBeGreaterThan(idle.gain)
    expect(full.hz).toBeGreaterThan(idle.hz)
    expect(full.flutter).toBeGreaterThan(idle.flutter)
  })
  it('is louder for the trench forge and quieter from across the room', () => {
    expect(fireVoice(0.5, true, false).gain).toBeGreaterThan(fireVoice(0.5, false, false).gain)
    expect(fireVoice(0.5, false, true).gain).toBeLessThan(fireVoice(0.5, false, false).gain)
  })
  it('stays in range whatever it is given', () => {
    for (const blast of [-1, 0, 0.5, 1, 3]) {
      for (const long of [false, true]) {
        const v = fireVoice(blast, long, false)
        expect(v.gain).toBeGreaterThanOrEqual(0)
        expect(v.gain).toBeLessThanOrEqual(1)
        expect(v.flutter).toBeLessThanOrEqual(1)
        expect(v.hz).toBeGreaterThan(0)
      }
    }
  })
})

describe('the sounds of the trial stand', () => {
  const names = (id: Parameters<typeof trialCues>[0], outcome: Parameters<typeof trialCues>[1], bow?: number) =>
    trialCues(id, outcome, bow).map((c) => c.sound)

  it('a rope cut swishes, then tells a clean cut from a drag from a bounce', () => {
    expect(names('rope', 'clean')).toEqual(['swish', 'ropeCut'])
    expect(names('rope', 'partCut')).toEqual(['swish', 'ropeDrag'])
    expect(names('rope', 'bounced')).toEqual(['swish', 'bounce'])
    expect(names('mat', 'cut')).toEqual(['swish', 'matCut'])
  })
  it('a blade that snaps in the chop never gets its second blow', () => {
    expect(names('chop', 'held')).toEqual(['chop', 'chop', 'split'])
    expect(names('chop', 'chipped')).toEqual(['chop', 'chop', 'chip', 'split'])
    expect(names('chop', 'snapped')).toEqual(['chop', 'snap'])
  })
  it('a failure can be heard: a dull edge drags, a brittle one snaps or chips', () => {
    expect(names('shave', 'shaves')).not.toEqual(names('shave', 'wontShave'))
    expect(names('board', 'glides')).not.toEqual(names('board', 'wedges'))
    expect(names('bend', 'snapped')).toContain('snap')
    expect(names('bend', 'bent90')).not.toContain('snap')
    expect(names('brass', 'chips')).toContain('chip')
    expect(names('flex', 'springsTrue')).toContain('spring')
    expect(names('flex', 'takesSet')).not.toContain('spring')
  })
  it('a sword that snaps early in its bow sounds early', () => {
    const early = trialCues('flex', 'snapped', 0.3).find((c) => c.sound === 'snap')
    const late = trialCues('flex', 'snapped', 1).find((c) => c.sound === 'snap')
    expect(early?.at).toBeLessThan(late?.at ?? 0)
  })
  it('every cue is in order, inside the playback, and names a real sound', () => {
    const ids = ['fit', 'rope', 'brass', 'chop', 'shave', 'board', 'bend', 'flex', 'mat'] as const
    const outcomes = ['fine', 'clean', 'partCut', 'bounced', 'chips', 'held', 'chipped', 'snapped', 'shaves', 'wontShave', 'glides', 'wedges', 'bent90', 'springsTrue', 'takesSet'] as const
    for (const id of ids) {
      for (const outcome of outcomes) {
        const cues = trialCues(id, outcome, 0.5)
        let last = 0
        for (const c of cues) {
          expect(c.at).toBeGreaterThanOrEqual(last)
          expect(c.at).toBeLessThan(1)
          expect(TRIAL_SOUNDS[c.sound]).toBeDefined()
          last = c.at
        }
      }
    }
  })
  it('each cue plays once as time moves through it', () => {
    const cues = trialCues('chop', 'held')
    const heard: string[] = []
    for (let i = 0; i < 50; i++) heard.push(...cuesDue(cues, i / 50, (i + 1) / 50))
    expect(heard).toEqual(['chop', 'chop', 'split'])
    expect(cuesDue(cues, 0.2, 0.2)).toEqual([])
  })
})

describe('small sounds round the forge', () => {
  it('the bar sounds as it arrives in the coals or on the anvil, and not while it stays put', () => {
    expect(placeCue('anvil', 'fire')).toBe('coals')
    expect(placeCue('air', 'anvil')).toBe('setDown')
    expect(placeCue('fire', 'fire')).toBeNull()
    expect(placeCue('anvil', 'air')).toBeNull()
    // The tank has its own hiss.
    expect(placeCue('air', 'quench')).toBeNull()
  })
  it('steel only crackles when it is burning in the fire, faster the hotter it is', () => {
    expect(sparkRate('fire', 1200, 1290)).toBe(0)
    expect(sparkRate('anvil', 1400, 1290)).toBe(0)
    expect(sparkRate('fire', 1290, 1290)).toBe(SPARK_SOUND.slowest)
    expect(sparkRate('fire', 1350, 1290)).toBeGreaterThan(sparkRate('fire', 1300, 1290))
    expect(sparkRate('fire', 3000, 1290)).toBe(SPARK_SOUND.fastest)
  })
  it('no sound is held back for long', () => {
    for (const shapes of Object.values(FORGE_SOUNDS)) {
      for (const shape of shapes) expect('delay' in shape ? shape.delay : 0).toBeLessThan(0.5)
    }
  })
})

describe('the sea outside', () => {
  it('is plainer by the window than at the forge, and always under the fire', () => {
    expect(seaVoice(true).gain).toBeGreaterThan(seaVoice(false).gain)
    expect(seaVoice(false).gain).toBeLessThan(fireVoice(0, false, false).gain)
    expect(seaVoice(true).flutter).toBeLessThanOrEqual(1)
  })
})
