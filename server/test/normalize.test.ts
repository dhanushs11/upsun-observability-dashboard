import { describe, expect, it } from 'vitest'
import {
  attachPods,
  envPhase,
  normalizeDeployment,
  shortType,
  type NormalizedDeployment,
} from '../src/normalize.js'

const sample = {
  webapps: {
    surl: {
      type: 'php:8.3:619',
      size: 'AUTO',
      disk: 2048,
      crons: { drupal: { spec: '*/19 * * * *', commands: { start: 'cd web ; drush core-cron' } } },
      mounts: { '/tmp': {}, '/private': {} },
      relationships: { database: { service: 'db' }, redis: { service: 'cache' } },
    },
  },
  workers: {
    queue: { type: 'nodejs:20:abc', size: 'S', disk: null },
  },
  services: {
    db: { type: 'mariadb:10.11:214', disk: 2560 },
    cache: { type: 'redis-persistent:6.0:398', disk: 384 },
  },
  routes: {
    'https://main.example/': { url: 'https://main.example/', primary: true, type: 'upstream', upstream: 'surl:http' },
    'http://www.example/': { url: 'http://www.example/', primary: false, type: 'redirect', to: 'https://x/' },
  },
}

describe('shortType', () => {
  it('strips build suffix', () => {
    expect(shortType('php:8.3:619')).toBe('php:8.3')
    expect(shortType('redis-persistent:6.0:398')).toBe('redis-persistent:6.0')
    expect(shortType('weird')).toBe('weird')
  })
})

describe('normalizeDeployment', () => {
  const result = normalizeDeployment(sample)

  it('maps webapps and workers into workloads', () => {
    expect(result.workloads.map((w) => w.name).sort()).toEqual(['queue', 'surl'])
    const surl = result.workloads.find((w) => w.name === 'surl')!
    expect(surl.kind).toBe('webapp')
    expect(surl.runtime).toBe('php:8.3')
    expect(surl.diskMiB).toBe(2048)
    expect(surl.crons).toEqual([
      { name: 'drupal', spec: '*/19 * * * *', command: 'cd web ; drush core-cron' },
    ])
    expect(surl.mounts.sort()).toEqual(['/private', '/tmp'])
    expect(surl.relationships.sort()).toEqual(['database', 'redis'])
  })

  it('normalizes services and routes', () => {
    expect(result.services).toEqual([
      { name: 'db', type: 'mariadb:10.11:214', diskMiB: 2560 },
      { name: 'cache', type: 'redis-persistent:6.0:398', diskMiB: 384 },
    ])
    expect(result.routes[0]).toEqual({
      id: 'https://main.example/',
      url: 'https://main.example/',
      primary: true,
      type: 'upstream',
      upstream: 'surl:http',
    })
    // "to" fallback for redirects
    expect(result.routes[1].upstream).toBe('https://x/')
  })

  it('handles empty deployment gracefully', () => {
    expect(normalizeDeployment({})).toEqual({
      workloads: [],
      services: [],
      routes: [],
      pods: [],
    })
  })
})

describe('attachPods', () => {
  it('derives pods from observability summary', () => {
    const base: NormalizedDeployment = normalizeDeployment(sample)
    const summary = {
      data: { services: { blog: { 'blog.0': {}, 'blog.1': {} }, cache: { 'cache.0': {} } } },
    }
    const withPods = attachPods(base, summary)
    expect(withPods.pods.map((p) => p.name)).toEqual(['blog.0', 'blog.1', 'cache.0'])
    expect(withPods.pods[1].instance).toBe(1)
  })
})

describe('envPhase', () => {
  it.each([
    ['active', 'Running'],
    ['paused', 'Paused'],
    ['inactive', 'Inactive'],
    ['other', 'Unknown'],
  ])('%s -> %s', (input, expected) => {
    expect(envPhase(input)).toBe(expected)
  })
})
