#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node tools/build_html_partials.js [template] [output] [--check]');
  console.log('Defaults: template=html-src/index.template.html output=index.html');
}

const args = process.argv.slice(2);
let checkOnly = false;
const positional = [];
for (const arg of args) {
  if (arg === '--check') checkOnly = true;
  else if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  } else positional.push(arg);
}

const templatePath = path.resolve(positional[0] || 'html-src/index.template.html');
const outputPath = path.resolve(positional[1] || 'index.html');

function expandIncludes(filePath, stack = []) {
  const absPath = path.resolve(filePath);
  if (stack.includes(absPath)) {
    throw new Error(`Recursive include detected:\n${[...stack, absPath].join('\n-> ')}`);
  }
  const dir = path.dirname(absPath);
  const source = fs.readFileSync(absPath, 'utf8');
  return source.replace(/<!--\s*@include\s+([^\s]+)\s*-->/g, (_match, relPath) => {
    const includePath = path.resolve(dir, relPath);
    if (!fs.existsSync(includePath)) {
      throw new Error(`Missing include: ${path.relative(process.cwd(), includePath)}`);
    }
    return expandIncludes(includePath, [...stack, absPath]);
  });
}

const built = expandIncludes(templatePath);
const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;

if (checkOnly) {
  if (existing === built) {
    console.log(`OK: ${path.relative(process.cwd(), outputPath)} is up to date.`);
    process.exit(0);
  }
  console.error(`OUTDATED: ${path.relative(process.cwd(), outputPath)} differs from built template.`);
  process.exit(1);
}

fs.writeFileSync(outputPath, built, 'utf8');
const status = existing === null ? 'created' : existing === built ? 'unchanged' : 'updated';
console.log(`Build ${status}: ${path.relative(process.cwd(), outputPath)}`);
