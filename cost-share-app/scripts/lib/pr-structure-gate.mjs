/**
 * PR structure gate — validates PR body sections, test file claims vs diff, and spec touch rules.
 * Used by ci-pr-structure-gate.sh and unit-tested via node:test.
 */

import fs from 'node:fs';

/** @typedef {{ ok: boolean; errors: string[]; warnings: string[]; meta: Record<string, unknown> }} GateResult */

export const REQUIRED_SECTIONS = ['Implementation', 'Tests', 'Proof', 'Spec'];

/** Paths that satisfy the Spec section when changed (see docs/TESTING.md). */
export const SPEC_DOC_PREFIXES = [
  'docs/SSOT/',
  'docs/TESTING.md',
  'docs/CI_CD.md',
  'docs/superpowers/specs/',
];

export const SPEC_NO_CHANGE_RE = /^Spec:\s*no change needed\s*-\s*.+/im;

export const NO_TESTS_JUSTIFICATION_RE = /^No tests needed:\s*.+/im;

const TEST_FILE_RE =
  /(?:^|\/)(?:__tests__\/|.*\.(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs))(?:$|\/)/;

const APP_CODE_PREFIXES = ['cost-share-app/apps/', 'cost-share-app/packages/'];

const DOCS_ONLY_FILE_RE = /^(docs\/|[^/]+\.md$)$/;

const DEPENDABOT_ALLOWED_RE =
  /^(?:cost-share-app\/package-lock\.json|\.github\/(?:workflows\/|dependabot\.yml)|.*\/package-lock\.json)$/;

/**
 * @param {string} body
 * @returns {Record<string, string>}
 */
export function parsePrSections(body) {
  const sections = /** @type {Record<string, string>} */ ({});
  if (!body || !body.trim()) {
    return sections;
  }
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  /** @type {string | null} */
  let current = null;
  /** @type {string[]} */
  let buf = [];

  const flush = () => {
    if (current !== null) {
      sections[current] = buf.join('\n').trim();
    }
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      current = m[1].trim();
      continue;
    }
    if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * @param {string} path
 */
export function isTestFile(path) {
  return TEST_FILE_RE.test(path);
}

/**
 * @param {string} path
 */
export function isSpecDocPath(path) {
  return SPEC_DOC_PREFIXES.some((p) => path === p || path.startsWith(p));
}

/**
 * @param {string} path
 */
export function isAppCodePath(path) {
  if (!path.startsWith('cost-share-app/')) return false;
  if (isTestFile(path)) return false;
  if (path.startsWith('cost-share-app/docs/')) return false;
  return APP_CODE_PREFIXES.some((p) => path.startsWith(p));
}

/**
 * @param {string[]} changedFiles
 */
export function isDocsCiOnlyChange(changedFiles) {
  if (changedFiles.length === 0) return false;
  return changedFiles.every((f) => DOCS_ONLY_FILE_RE.test(f));
}

/**
 * @param {string} authorLogin
 * @param {string[]} changedFiles
 */
export function isDependabotExempt(authorLogin, changedFiles) {
  if (authorLogin !== 'dependabot[bot]') return false;
  if (changedFiles.length === 0) return false;
  return changedFiles.every((f) => DEPENDABOT_ALLOWED_RE.test(f));
}

/**
 * @param {string} title
 * @param {string[]} labels
 */
export function isBugFixPr(title, labels) {
  const norm = labels.map((l) => l.toLowerCase());
  if (norm.includes('bug')) return true;
  return /^fix(\([^)]+\))?!?:/i.test(title.trim());
}

/**
 * Extract path-like strings from the Tests section (backticks, bullets, plain paths).
 * @param {string} testsSection
 * @returns {string[]}
 */
export function extractListedTestFiles(testsSection) {
  if (!testsSection) return [];
  /** @type {Set<string>} */
  const found = new Set();
  const backtick = /`([^`\n]+)`/g;
  let m;
  while ((m = backtick.exec(testsSection)) !== null) {
    const p = m[1].trim();
    if (isTestFile(p)) found.add(p);
  }
  const pathLike =
    /(?:^|\s)((?:cost-share-app\/)?[\w./-]*(?:__tests__\/[\w./-]+|\w+\.(?:test|spec)\.(?:tsx?|jsx?|mjs)))/gm;
  while ((m = pathLike.exec(testsSection)) !== null) {
    let p = m[1].trim();
    if (!p.startsWith('cost-share-app/') && p.includes('/')) {
      p = `cost-share-app/${p.replace(/^\/+/, '')}`;
    }
    if (isTestFile(p)) found.add(p);
  }
  return [...found];
}

/**
 * @param {object} input
 * @param {string} input.body
 * @param {string} input.title
 * @param {string[]} input.labels
 * @param {string} input.authorLogin
 * @param {string[]} input.changedFiles
 * @returns {GateResult}
 */
export function validatePrStructure(input) {
  const { body, title, labels, authorLogin, changedFiles } = input;
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (isDependabotExempt(authorLogin, changedFiles)) {
    return {
      ok: true,
      errors: [],
      warnings: ['Dependabot lockfile/workflow-only exemption applied.'],
      meta: { exempt: 'dependabot' },
    };
  }

  const sections = parsePrSections(body);
  for (const name of REQUIRED_SECTIONS) {
    const content = sections[name];
    if (content === undefined) {
      errors.push(`Missing ## ${name} section in PR description.`);
      continue;
    }
    if (!content || content.length < 20) {
      errors.push(
        `## ${name} section is too short — add a full description (not just placeholders).`,
      );
    }
    if (/^(\s*[-*]\s*)?(TBD|TODO|\.{3}|xxx)\s*$/im.test(content)) {
      errors.push(`## ${name} looks like a placeholder; replace with real content.`);
    }
  }

  const changedTests = changedFiles.filter(isTestFile);
  const appCodeTouched = changedFiles.some(isAppCodePath);
  const docsCiOnly = isDocsCiOnlyChange(changedFiles);
  const hasNoTestsLabel = labels.map((l) => l.toLowerCase()).includes('no-tests-needed');

  if (appCodeTouched && !docsCiOnly) {
    if (changedTests.length === 0 && !hasNoTestsLabel) {
      errors.push(
        'App code changed under cost-share-app/ without test file changes — add tests or label `no-tests-needed` with a `No tests needed: …` line in the PR body.',
      );
    }
    if (changedTests.length === 0 && hasNoTestsLabel && !NO_TESTS_JUSTIFICATION_RE.test(body)) {
      errors.push(
        'Label `no-tests-needed` requires a body line: `No tests needed: <reason>`.',
      );
    }
  }

  const listedTests = extractListedTestFiles(sections.Tests ?? '');
  const changedSet = new Set(changedTests);
  for (const listed of listedTests) {
    if (!changedSet.has(listed)) {
      errors.push(
        `Tests section lists \`${listed}\` but that file is not changed in this PR diff.`,
      );
    }
  }
  if (changedTests.length > 0 && listedTests.length === 0) {
    errors.push(
      'Tests section must list the test file paths changed in this PR (use backticks or paths).',
    );
  }
  if (changedTests.length > 0) {
    for (const tf of changedTests) {
      const mentioned =
        listedTests.includes(tf) ||
        (sections.Tests ?? '').includes(tf) ||
        tf.split('/').pop();
      if (!mentioned) {
        errors.push(`Changed test file \`${tf}\` must be mentioned in ## Tests.`);
      }
    }
  }

  const specTouched = changedFiles.some(isSpecDocPath);
  const specLineOk = SPEC_NO_CHANGE_RE.test(body);
  if (!specTouched && !specLineOk) {
    errors.push(
      'Spec section requires a change under docs/SSOT/, docs/TESTING.md, docs/CI_CD.md, or docs/superpowers/specs/ — or add `Spec: no change needed - <reason>` in the PR body.',
    );
  }

  const bugFix = isBugFixPr(title, labels);
  if (bugFix && changedTests.length === 0 && !hasNoTestsLabel && !docsCiOnly) {
    errors.push('Bug-fix PRs must include regression test file changes for red/green proof.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    meta: {
      bugFix,
      changedTests,
      listedTests,
      specTouched,
      appCodeTouched,
      docsCiOnly,
    },
  };
}

/**
 * CLI entry when run directly.
 */
export function main(argv = process.argv.slice(2)) {
  const read = (flag) => {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    return argv[i + 1] ?? null;
  };
  if (argv[0] !== 'validate') {
    console.error('Usage: pr-structure-gate.mjs validate --body-file <path> --title <t> ...');
    process.exit(2);
  }
  const bodyFile = read('--body-file');
  const title = read('--title') ?? '';
  const author = read('--author') ?? '';
  const labelsRaw = read('--labels') ?? '';
  const diffFile = read('--diff-files') ?? '';
  const labels = labelsRaw ? labelsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : '';
  const changedFiles = diffFile
    ? fs
        .readFileSync(diffFile, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  const result = validatePrStructure({
    body,
    title,
    labels,
    authorLogin: author,
    changedFiles,
  });

  for (const w of result.warnings) {
    console.log(`::warning::${w}`);
  }
  for (const e of result.errors) {
    console.log(`::error::${e}`);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('pr-structure-gate.mjs') ||
    process.argv[1].includes('pr-structure-gate.mjs'));
if (isMain) {
  main();
}
