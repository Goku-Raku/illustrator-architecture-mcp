export function validatePackageFiles(files) {
  const paths = files.map((file) => typeof file === 'string' ? file : file.path);
  const required = [
    'package.json', 'LICENSE', 'UPSTREAM.md', 'ACKNOWLEDGEMENTS.md', 'DISCLAIMER.md', 'README.md', 'README.zh-CN.md', 'README.en.md', 'README.ja.md',
    'dist/index.js', 'dist/bundle.cjs', 'dist/jsx/helpers/common.jsx',
    'dist/THIRD-PARTY-NOTICES.txt',
    'scripts/verify-offline.mjs', 'scripts/generate-config.mjs',
    'skills/architecture-diagramming/SKILL.md',
    'skills/architecture-diagramming/references/urban-site-analysis.md',
    'skills/architecture-diagramming/references/urban-analysis-atlas.md',
    'skills/architecture-diagramming/references/urban-worked-example.md',
  ];
  for (const name of required) if (!paths.includes(name)) throw new Error(`Release package is missing ${name}.`);
  for (const name of paths) {
    if (name.includes('\\') || name.startsWith('/') || name.split('/').includes('..')) throw new Error(`Unsafe archive path: ${name}`);
    const permitted = /^(?:dist\/|skills\/architecture-diagramming\/|scripts\/(?:verify-offline|generate-config)\.mjs$|examples\/(?:README\.md|urban-demo(?:\.(?:zh-TW|zh-CN|en|ja))?\.png|urban-site-input\.json)$|README(?:-ARCHITECTURE|\.(?:zh-CN|en|ja))?\.md$|AGENT_SETUP\.md$|ARCHITECTURE-WORKFLOWS\.md$|VALIDATION(?:-V[23])?\.md$|docs\/VALIDATION-ALPHA\.md$|docs\/(?:ANALYSIS-ATLAS|DIAGRAM-METHODOLOGY|PINTEREST-RESEARCH|UPGRADE-NOTES|UPGRADE-V3|URBAN-PINTEREST-RESEARCH|URBAN-SITE-ANALYSIS)\.zh-CN\.md$|(?:LICENSE|UPSTREAM\.md|ACKNOWLEDGEMENTS\.md|DISCLAIMER\.md|THIRD_PARTY_NOTICES\.md|PRIVACY\.md|SECURITY\.md|package\.json)$)/.test(name);
    if (!permitted || /(?:^|\/)(?:node_modules|outputs?|research|\.git|\.env|backups?|credentials?)(?:\/|\.|$)/i.test(name)) {
      throw new Error(`Unexpected/private release file: ${name}`);
    }
  }
  return { files: paths.length, required_files: required.length };
}
