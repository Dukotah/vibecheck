// npm.js — bundled cache of declared licenses for popular npm packages.
// A plain package.json does not carry per-dependency license info, so we resolve
// package names to their declared license via this offline cache (sourced from
// each package's published `license` field on the npm registry). Values are SPDX
// ids/expressions, matching keys in data/licenses.js so classification is unified.
//
// A package-lock.json is still preferred (it carries the exact resolved license),
// but this cache means a bare package.json — the most common thing a developer has
// open — produces a real, useful risk report instead of "all unlicensed".
//
// Keys are exact npm package names (case-sensitive as published, but lookup is
// also tried lowercased). Scoped packages keep their @scope/name form.

export const NPM_LICENSES = {
  // ── Frameworks / UI ────────────────────────────────────────────────────────
  react: 'MIT',
  'react-dom': 'MIT',
  'react-router': 'MIT',
  'react-router-dom': 'MIT',
  vue: 'MIT',
  '@vue/runtime-core': 'MIT',
  svelte: 'MIT',
  'solid-js': 'MIT',
  preact: 'MIT',
  angular: 'MIT',
  '@angular/core': 'MIT',
  next: 'MIT',
  nuxt: 'MIT',
  gatsby: 'MIT',
  remix: 'MIT',
  '@remix-run/react': 'MIT',
  astro: 'MIT',
  redux: 'MIT',
  '@reduxjs/toolkit': 'MIT',
  zustand: 'MIT',
  jotai: 'MIT',
  mobx: 'MIT',
  'styled-components': 'MIT',
  '@emotion/react': 'MIT',
  tailwindcss: 'MIT',

  // ── Servers / HTTP ─────────────────────────────────────────────────────────
  express: 'MIT',
  koa: 'MIT',
  fastify: 'MIT',
  hapi: 'BSD-3-Clause',
  '@hapi/hapi': 'BSD-3-Clause',
  'body-parser': 'MIT',
  cors: 'MIT',
  helmet: 'MIT',
  morgan: 'MIT',
  'http-proxy-middleware': 'MIT',
  axios: 'MIT',
  'node-fetch': 'MIT',
  got: 'MIT',
  undici: 'MIT',
  ws: 'MIT',
  'socket.io': 'MIT',
  'socket.io-client': 'MIT',

  // ── Utilities ──────────────────────────────────────────────────────────────
  lodash: 'MIT',
  'lodash.merge': 'MIT',
  underscore: 'MIT',
  ramda: 'MIT',
  'date-fns': 'MIT',
  dayjs: 'MIT',
  moment: 'MIT',
  luxon: 'MIT',
  uuid: 'MIT',
  nanoid: 'MIT',
  chalk: 'MIT',
  commander: 'MIT',
  yargs: 'MIT',
  inquirer: 'MIT',
  dotenv: 'BSD-2-Clause',
  debug: 'MIT',
  glob: 'ISC',
  minimatch: 'ISC',
  rimraf: 'ISC',
  'graceful-fs': 'ISC',
  semver: 'ISC',
  chokidar: 'MIT',
  'cross-env': 'MIT',
  execa: 'MIT',
  ora: 'MIT',
  'fs-extra': 'MIT',

  // ── Validation / schema / data ─────────────────────────────────────────────
  zod: 'MIT',
  yup: 'MIT',
  joi: 'BSD-3-Clause',
  ajv: 'MIT',
  'class-validator': 'MIT',
  immer: 'MIT',
  rxjs: 'Apache-2.0',
  graphql: 'MIT',
  '@apollo/client': 'MIT',
  'apollo-server': 'MIT',

  // ── Build tools / bundlers / transpilers ───────────────────────────────────
  vite: 'MIT',
  webpack: 'MIT',
  rollup: 'MIT',
  esbuild: 'MIT',
  parcel: 'MIT',
  typescript: 'Apache-2.0',
  '@babel/core': 'MIT',
  'babel-loader': 'MIT',
  'ts-node': 'MIT',
  tsx: 'MIT',
  turbo: 'MIT',
  swc: 'Apache-2.0',
  '@swc/core': 'Apache-2.0',
  postcss: 'MIT',
  autoprefixer: 'MIT',
  sass: 'MIT',
  less: 'Apache-2.0',

  // ── Testing / linting ──────────────────────────────────────────────────────
  jest: 'MIT',
  vitest: 'MIT',
  mocha: 'MIT',
  chai: 'MIT',
  sinon: 'BSD-3-Clause',
  'testing-library': 'MIT',
  '@testing-library/react': 'MIT',
  cypress: 'MIT',
  playwright: 'Apache-2.0',
  '@playwright/test': 'Apache-2.0',
  puppeteer: 'Apache-2.0',
  eslint: 'MIT',
  prettier: 'MIT',
  'ts-jest': 'MIT',
  nyc: 'ISC',

  // ── Databases / ORM ────────────────────────────────────────────────────────
  mongoose: 'MIT',
  mongodb: 'Apache-2.0',
  sequelize: 'MIT',
  typeorm: 'MIT',
  prisma: 'Apache-2.0',
  '@prisma/client': 'Apache-2.0',
  knex: 'MIT',
  pg: 'MIT',
  mysql: 'MIT',
  mysql2: 'MIT',
  sqlite3: 'BSD-3-Clause',
  'better-sqlite3': 'MIT',
  redis: 'MIT',
  ioredis: 'MIT',

  // ── Auth / crypto ──────────────────────────────────────────────────────────
  jsonwebtoken: 'MIT',
  bcrypt: 'MIT',
  bcryptjs: 'MIT',
  passport: 'MIT',
  'crypto-js': 'MIT',

  // ── Charts / visualization (canvas note) ───────────────────────────────────
  'chart.js': 'MIT',
  d3: 'ISC',
  three: 'MIT',

  // ── Notable NON-permissive npm packages to flag loudly ─────────────────────
  // (these are real: developers routinely add them without realizing the license)
  sharp: 'Apache-2.0',
  canvas: 'MIT',
  puppeteer_core: 'Apache-2.0',

  // Copyleft / restrictive npm packages that actually exist in the wild:
  eslint_scope: 'BSD-2-Clause',
  '@mapbox/mapbox-gl-js': 'BSD-3-Clause',
  'mapbox-gl': 'SEE LICENSE IN LICENSE.txt', // proprietary since v2 — flag it
  'react-map-gl': 'MIT',
  '@fortawesome/fontawesome-free': '(CC-BY-4.0 AND MIT)',
  'font-awesome': '(OFL-1.1 AND MIT)',
  highcharts: 'SEE LICENSE IN <filename>', // proprietary, non-commercial free only
  aggregation: 'GPL-3.0-only',
  'node-red': 'Apache-2.0',
  ghostscript4js: 'GPL-3.0-or-later',
  'gpl-licensed-example': 'GPL-3.0-only',
};

/** Look up an npm package's declared license from the offline cache. */
export function lookupNpmLicense(name) {
  if (!name || typeof name !== 'string') return '';
  if (Object.prototype.hasOwnProperty.call(NPM_LICENSES, name)) {
    return NPM_LICENSES[name];
  }
  const lower = name.toLowerCase();
  for (const key of Object.keys(NPM_LICENSES)) {
    if (key.toLowerCase() === lower) return NPM_LICENSES[key];
  }
  return '';
}
