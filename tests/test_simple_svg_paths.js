// tests/test_simple_svg_paths.js
// Verifies SimpleSVG support for rounded rects, cubic/quadratic Bezier paths,
// compound contours (holes via fill-rule="evenodd"), clipping (<clipPath>), and style stack.

const assert = require('assert');
const path = require('path');

const SimpleSVG = require(path.join(__dirname, '../libraries/simple-svg.js'));

console.log('--- Testing SimpleSVG Extended Vector Capabilities ---');

// 1. Rounded rectangle
const svgRect = new SimpleSVG(100, 100);
svgRect.fill('#ffffff');
svgRect.noStroke();
svgRect.rect(-20, -20, 40, 40, 8);
const rectOut = svgRect.toSVGString();
assert.ok(rectOut.includes('rx="8.000" ry="8.000"'), 'Rounded rect must output rx and ry attributes');
console.log('✓ Rounded rectangle (rx/ry) serialization verified.');

// 2. Cubic Bezier + Compound Contour (hole with evenodd fill-rule)
const svgBezier = new SimpleSVG(100, 100);
svgBezier.fill('#e2e0dc');
svgBezier.noStroke();
svgBezier.beginShape();
svgBezier.vertex(-40, -40);
svgBezier.bezierVertex(-10, -40, 40, 10, 40, 40);
svgBezier.vertex(-40, 40);
svgBezier.beginContour();
svgBezier.vertex(-15, -15);
svgBezier.vertex(-15, 15);
svgBezier.vertex(15, 15);
svgBezier.endContour();
svgBezier.endShape('CLOSE');

const bezierOut = svgBezier.toSVGString();
assert.ok(bezierOut.includes('C -10.000,-40.000 40.000,10.000 40.000,40.000'), 'Cubic Bezier C command must be emitted');
assert.ok(bezierOut.includes('fill-rule="evenodd"'), 'Compound path with contour hole must emit fill-rule="evenodd"');
assert.strictEqual((bezierOut.match(/M /g) || []).length, 2, 'Outer + inner contour must produce 2 M subpaths');
console.log('✓ Cubic Bezier and compound contour holes (evenodd) verified.');

// 3. Clipping rect inside transformed group
const svgClip = new SimpleSVG(200, 200);
svgClip.push();
svgClip.translate(100, 100);
svgClip.beginClipRect(-50, -50, 100, 100);
svgClip.fill('#ff0000');
svgClip.ellipse(0, 0, 160, 160);
svgClip.endClip();
svgClip.pop();

const clipOut = svgClip.toSVGString();
assert.ok(clipOut.includes('<defs>'), 'Clipping must generate <defs> block');
assert.ok(clipOut.includes('<clipPath id="ts_clip_1">'), 'clipPath definition must be registered');
assert.ok(clipOut.includes('<g clip-path="url(#ts_clip_1)">'), 'Clipped group must reference clipPath');
assert.ok(clipOut.includes('</g>'), 'Clipped group must close cleanly');
console.log('✓ Subtile <clipPath> generation under transforms verified.');

// 4. Push/pop style restoration
const svgStyle = new SimpleSVG(100, 100);
svgStyle.fill('#111111');
svgStyle.stroke('#222222');
svgStyle.strokeWeight(2);
svgStyle.push();
svgStyle.noFill();
svgStyle.stroke('#ffffff');
svgStyle.strokeWeight(5);
svgStyle.strokeCap('ROUND');
svgStyle.line(0, 0, 10, 10);
svgStyle.pop();
svgStyle.rect(0, 0, 10, 10);

const styleOut = svgStyle.toSVGString();
assert.ok(styleOut.includes('stroke-linecap="round"'), 'strokeCap(ROUND) must emit stroke-linecap="round"');
assert.ok(styleOut.includes('fill="#111111" stroke="#222222" stroke-width="2"'), 'pop() must restore prior fill/stroke/weight');
console.log('✓ Style stack push/pop and stroke-linecap/join verified.');

console.log('--- ALL SIMPLESVG EXTENDED CHECKS PASSED! ---');
