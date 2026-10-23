import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

describe('Vercel Image Optimization Governance & Safe Delivery', () => {
  it('should have strict, bounded next.config.js image optimization settings', async () => {
    const nextConfigPath = path.join(frontendDir, 'next.config.js');
    assert.ok(fs.existsSync(nextConfigPath), 'next.config.js must exist');

    // Dynamic import next.config.js
    const configModule = await import(`file://${nextConfigPath}`);
    const nextConfig = configModule.default || configModule;

    assert.ok(nextConfig.images, 'nextConfig.images must be configured');

    // Verify bounded deviceSizes to avoid generating 8+ responsive variants
    assert.deepEqual(
      nextConfig.images.deviceSizes,
      [640, 1080, 1920],
      'deviceSizes must be constrained to 3 responsive tiers to avoid burning transformations',
    );

    // Verify bounded imageSizes
    assert.deepEqual(
      nextConfig.images.imageSizes,
      [32, 64, 128, 256],
      'imageSizes must be constrained to essential UI sizes',
    );

    // Verify minimumCacheTTL is at least 30 days (2,592,000s) instead of default 60s
    assert.ok(
      nextConfig.images.minimumCacheTTL >= 2592000,
      'minimumCacheTTL must be at least 30 days to avoid re-transforming cached assets',
    );

    // Verify single modern format to prevent multiplying transformation counts
    assert.deepEqual(
      nextConfig.images.formats,
      ['image/webp'],
      'formats must specify webp to prevent multi-format transformation multipliers',
    );

    // Verify safe SVG handling
    assert.equal(nextConfig.images.dangerouslyAllowSVG, true);
    assert.ok(nextConfig.images.contentSecurityPolicy, 'CSP must be specified for SVGs');
  });

  it('should define edge cache headers in next.config.js for static images and assets', async () => {
    const nextConfigPath = path.join(frontendDir, 'next.config.js');
    const configModule = await import(`file://${nextConfigPath}`);
    const nextConfig = configModule.default || configModule;

    assert.equal(typeof nextConfig.headers, 'function', 'headers() function must be defined');
    const headers = await nextConfig.headers();
    assert.ok(Array.isArray(headers) && headers.length > 0, 'headers list must not be empty');

    const staticImagesRule = headers.find((h) => h.source && h.source.includes('svg'));
    assert.ok(staticImagesRule, 'Static image rule must be defined');
    const cacheControl = staticImagesRule.headers.find((h) => h.key === 'Cache-Control');
    assert.ok(cacheControl, 'Cache-Control header must be set for static images');
    assert.ok(cacheControl.value.includes('public'), 'Cache-Control should be public');
  });

  it('should configure vercel.json headers for edge caching of static icons and SVGs', () => {
    const vercelConfigPath = path.join(frontendDir, 'vercel.json');
    assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist');

    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    assert.ok(Array.isArray(vercelConfig.headers), 'vercel.json headers array must exist');

    const imageHeader = vercelConfig.headers.find((h) => h.source && h.source.includes('svg'));
    assert.ok(imageHeader, 'vercel.json must have static image cache header rule');
  });

  it('should verify public icons exist and are compact SVGs without raster bloat', () => {
    const iconPath = path.join(frontendDir, 'public', 'icon.svg');
    const faviconPath = path.join(frontendDir, 'public', 'favicon.svg');

    assert.ok(fs.existsSync(iconPath), 'public/icon.svg must exist');
    assert.ok(fs.existsSync(faviconPath), 'public/favicon.svg must exist');

    const iconStats = fs.statSync(iconPath);
    assert.ok(
      iconStats.size < 5000,
      `icon.svg should be a compact vector under 5KB, was ${iconStats.size} bytes`,
    );

    const iconContent = fs.readFileSync(iconPath, 'utf8');
    assert.ok(iconContent.startsWith('<svg'), 'icon.svg must be valid SVG markup');
  });

  it('should verify SafeImage component exists with quota fallback architecture', () => {
    const safeImagePath = path.join(frontendDir, 'src', 'components', 'SafeImage.tsx');
    assert.ok(fs.existsSync(safeImagePath), 'SafeImage.tsx must exist');

    const content = fs.readFileSync(safeImagePath, 'utf8');
    assert.ok(content.includes('shouldBypassOptimization'), 'Must include bypass helper');
    assert.ok(content.includes('hasTransformationError'), 'Must track transformation errors');
    assert.ok(content.includes('effectiveUnoptimized'), 'Must resolve effective unoptimized flag');
    assert.ok(content.includes('safe-image-fallback'), 'Must provide accessible fallback');
  });
});
