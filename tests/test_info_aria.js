// tests/test_info_aria.js
// Tests accessible ARIA attributes across all progressive disclosure info triggers and #btnHelp.

const fs = require('fs');
const path = require('path');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

const htmlPath = path.join(baseDir, 'index.html');
console.log('--- Testing Info Triggers ARIA Attributes ---');
console.log('Testing HTML file:', htmlPath);

const html = fs.readFileSync(htmlPath, 'utf8');

// Simple regex parser for tags with data-info-topic
const infoTagRegex = /<([a-zA-Z0-9_-]+)\s+[^>]*?data-info-topic=["']([^"']+)["'][^>]*?>/g;
let match;
const triggers = [];

while ((match = infoTagRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const topic = match[2];
  triggers.push({ tag: fullTag, topic });
}

console.log(`Found ${triggers.length} info triggers with data-info-topic.`);

if (triggers.length < 9) {
  throw new Error(`Expected at least 9 info triggers with data-info-topic, found ${triggers.length}`);
}

for (const { tag, topic } of triggers) {
  if (!tag.includes('aria-controls="infoPopover"')) {
    throw new Error(`Trigger for topic "${topic}" missing aria-controls="infoPopover":\n  ${tag}`);
  }
  if (!tag.includes('aria-haspopup="dialog"')) {
    throw new Error(`Trigger for topic "${topic}" missing aria-haspopup="dialog":\n  ${tag}`);
  }
  if (!tag.includes('aria-expanded="false"')) {
    throw new Error(`Trigger for topic "${topic}" missing aria-expanded="false":\n  ${tag}`);
  }
}
console.log('✓ All data-info-topic triggers have aria-controls="infoPopover", aria-haspopup="dialog", and aria-expanded="false".');

// Check #btnHelp
const btnHelpMatch = html.match(/<button\s+[^>]*?id=["']btnHelp["'][^>]*?>/);
if (!btnHelpMatch) {
  throw new Error('Button #btnHelp not found in index.html');
}
const btnHelpTag = btnHelpMatch[0];
if (!btnHelpTag.includes('aria-controls="infoPopover"')) {
  throw new Error(`Button #btnHelp missing aria-controls="infoPopover":\n  ${btnHelpTag}`);
}
console.log('✓ Button #btnHelp has aria-controls="infoPopover".');

// Verify infoPopover has role="dialog" and not modal
const popoverMatch = html.match(/<(?:div|aside|section)\s+[^>]*?id=["']infoPopover["'][^>]*?>/);
if (!popoverMatch) {
  throw new Error('Element #infoPopover not found in index.html');
}
const popoverTag = popoverMatch[0];
if (!popoverTag.includes('role="dialog"')) {
  throw new Error(`Element #infoPopover must have role="dialog":\n  ${popoverTag}`);
}
if (popoverTag.includes('aria-modal="true"')) {
  throw new Error('Element #infoPopover should NOT be marked aria-modal="true"');
}
console.log('✓ Element #infoPopover properly configured as non-modal role="dialog".');

console.log('--- ALL INFO ARIA CHECKS PASSED PERFECTLY! ---');
