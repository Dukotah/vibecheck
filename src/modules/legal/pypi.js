// pypi.js — bundled cache of declared licenses for popular PyPI packages.
// requirements.txt does not carry license info, so we resolve package names to
// their declared license via this offline cache (sourced from each project's
// PyPI "License" / classifier metadata). Values are SPDX ids where a clean one
// exists, matching keys in data/licenses.js so classification is unified.
//
// Keys are lowercased canonical PyPI project names.

export const PYPI_LICENSES = {
  // Web frameworks / servers
  django: 'BSD-3-Clause',
  flask: 'BSD-3-Clause',
  fastapi: 'MIT',
  starlette: 'BSD-3-Clause',
  uvicorn: 'BSD-3-Clause',
  gunicorn: 'MIT',
  werkzeug: 'BSD-3-Clause',
  jinja2: 'BSD-3-Clause',
  bottle: 'MIT',
  tornado: 'Apache-2.0',
  aiohttp: 'Apache-2.0',
  sanic: 'MIT',
  pyramid: 'BSD-3-Clause', // technically Repoze BSD-like
  falcon: 'Apache-2.0',
  httpx: 'BSD-3-Clause',
  requests: 'Apache-2.0',
  urllib3: 'MIT',
  certifi: 'MPL-2.0',
  charset_normalizer: 'MIT',
  'charset-normalizer': 'MIT',
  idna: 'BSD-3-Clause',

  // Data / science
  numpy: 'BSD-3-Clause',
  pandas: 'BSD-3-Clause',
  scipy: 'BSD-3-Clause',
  'scikit-learn': 'BSD-3-Clause',
  sklearn: 'BSD-3-Clause',
  matplotlib: 'PSF-2.0',
  seaborn: 'BSD-3-Clause',
  sympy: 'BSD-3-Clause',
  statsmodels: 'BSD-3-Clause',
  pillow: 'HPND',
  'pillow-simd': 'HPND',
  opencv_python: 'Apache-2.0',
  'opencv-python': 'Apache-2.0',

  // ML / AI
  torch: 'BSD-3-Clause',
  tensorflow: 'Apache-2.0',
  keras: 'Apache-2.0',
  transformers: 'Apache-2.0',
  datasets: 'Apache-2.0',
  xgboost: 'Apache-2.0',
  lightgbm: 'MIT',
  openai: 'Apache-2.0',
  anthropic: 'MIT',
  langchain: 'MIT',
  tiktoken: 'MIT',
  'sentence-transformers': 'Apache-2.0',

  // ORMs / DB
  sqlalchemy: 'MIT',
  alembic: 'MIT',
  psycopg2: 'LGPL-3.0-or-later',
  'psycopg2-binary': 'LGPL-3.0-or-later',
  psycopg: 'LGPL-3.0-or-later',
  'mysql-connector-python': 'GPL-2.0-only',
  mysqlclient: 'GPL-2.0-only',
  pymongo: 'Apache-2.0',
  redis: 'MIT',
  'redis-py': 'MIT',
  peewee: 'MIT',
  pymysql: 'MIT',

  // Utilities
  pydantic: 'MIT',
  'pydantic-settings': 'MIT',
  click: 'BSD-3-Clause',
  rich: 'MIT',
  typer: 'MIT',
  tqdm: 'MPL-2.0', // dual MPL-2.0 / MIT
  colorama: 'BSD-3-Clause',
  pyyaml: 'MIT',
  'python-dotenv': 'BSD-3-Clause',
  'python-dateutil': 'Apache-2.0', // dual Apache-2.0 / BSD-3-Clause
  pytz: 'MIT',
  attrs: 'MIT',
  'more-itertools': 'MIT',
  six: 'MIT',
  packaging: 'Apache-2.0',
  setuptools: 'MIT',
  wheel: 'MIT',
  pip: 'MIT',

  // Testing / tooling
  pytest: 'MIT',
  'pytest-cov': 'MIT',
  tox: 'MIT',
  black: 'MIT',
  flake8: 'MIT',
  isort: 'MIT',
  mypy: 'MIT',
  ruff: 'MIT',
  pylint: 'GPL-2.0-or-later',
  coverage: 'Apache-2.0',
  hypothesis: 'MPL-2.0',
  faker: 'MIT',

  // Crypto / security
  cryptography: 'Apache-2.0', // dual Apache-2.0 / BSD-3-Clause
  pyjwt: 'MIT',
  bcrypt: 'Apache-2.0',
  passlib: 'BSD-3-Clause',
  paramiko: 'LGPL-2.1-or-later',

  // Async / networking
  celery: 'BSD-3-Clause',
  kombu: 'BSD-3-Clause',
  websockets: 'BSD-3-Clause',
  'python-socketio': 'MIT',
  boto3: 'Apache-2.0',
  botocore: 'Apache-2.0',
  'google-cloud-storage': 'Apache-2.0',
  azure: 'MIT',

  // Scraping / parsing
  beautifulsoup4: 'MIT',
  bs4: 'MIT',
  lxml: 'BSD-3-Clause',
  scrapy: 'BSD-3-Clause',
  selenium: 'Apache-2.0',
  playwright: 'Apache-2.0',

  // Notable copyleft / non-permissive to flag loudly
  'pytesseract': 'Apache-2.0',
  'ffmpeg-python': 'Apache-2.0',
  'pyzmq': 'BSD-3-Clause',
  'chardet': 'LGPL-2.1-or-later',
  'reportlab': 'BSD-3-Clause',
  'python-ldap': 'Python-2.0',
  'pyqt5': 'GPL-3.0-only',
  'pyqt6': 'GPL-3.0-only',
  'pyside6': 'LGPL-3.0-only',
  'kivy': 'MIT',
  'youtube-dl': 'Unlicense',
  'yt-dlp': 'Unlicense',
};
