import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'TracePact',
  description: 'Behavioral testing framework for AI agents with tool use',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/quick-start' },
      { text: 'Reference', link: '/reference/assertions' },
      { text: 'GitHub', link: 'https://github.com/dcdeve/tracepact' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Quick Start', link: '/guide/quick-start' },
          { text: 'IDE Setup (MCP)', link: '/guide/ide-setup' },
          { text: 'Mock vs Live', link: '/guide/mock-vs-live' },
          { text: 'CI Integration', link: '/guide/ci-integration' },
          { text: 'skills.sh Integration', link: '/guide/skills-sh' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Assertions', link: '/reference/assertions' },
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'CLI', link: '/reference/cli' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Semantic Assertions', link: '/advanced/semantic-assertions' },
          { text: 'Judge Assertions', link: '/advanced/judge-assertions' },
          { text: 'Cassettes', link: '/advanced/cassettes' },
          { text: 'Flake Scoring', link: '/advanced/flake-scoring' },
        ],
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2026 dcdeve',
    },
  },
});
