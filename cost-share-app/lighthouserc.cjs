/** @type {import('@lhci/cli').LHCI.ServerCommand.Options & import('@lhci/cli').LHCI.CollectCommand.Options} */
module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:3000/'],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
