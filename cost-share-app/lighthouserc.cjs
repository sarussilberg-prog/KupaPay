/** @type {import('@lhci/cli').LHCI.ServerCommand.Options & import('@lhci/cli').LHCI.CollectCommand.Options} */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://127.0.0.1:3000/en',
        'http://127.0.0.1:3000/he',
        'http://127.0.0.1:3000/ar',
      ],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
