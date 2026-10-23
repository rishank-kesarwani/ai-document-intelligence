'use client';

import React, { useState, useMemo } from 'react';
import Image, { ImageProps } from 'next/image';
import { FileQuestion } from 'lucide-react';

export interface SafeImageProps extends Omit<ImageProps, 'onError'> {
  /** Optional fallback component or text when the image cannot be loaded at all */
  fallback?: React.ReactNode;
  /** Custom error handler callback if needed */
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

/**
 * Determines whether an image source is an SVG, local data/blob URI, or raw backend endpoint
 * that should bypass Vercel's image transformation pipeline to conserve transformations quota.
 */
function shouldBypassOptimization(src: ImageProps['src']): boolean {
  if (typeof src === 'string') {
    const cleanSrc = src.split('?')[0].toLowerCase();
    return (
      cleanSrc.endsWith('.svg') ||
      src.startsWith('data:') ||
      src.startsWith('blob:') ||
      src.includes('/documents/') ||
      src.includes('/api/v1/')
    );
  }
  return false;
}

/**
 * SafeImage - Resilient enterprise image component designed to eliminate unnecessary
 * Vercel Image Optimization transformations and safeguard against broken images when
 * transformation quotas are reached.
 *
 * Capabilities:
 * 1. Automatically sets unoptimized={true} for SVGs, vector icons, data/blob URIs, and backend document streams.
 * 2. Automatic Quota Fallback: If Vercel's /_next/image returns 402/500 (quota limit reached),
 *    it automatically falls back to rendering the source image directly with unoptimized={true}.
 * 3. Graceful Broken Image Handling: If the asset fails to load entirely, displays an accessible fallback card.
 * 4. Preserves Next.js benefits (intrinsic aspect ratio, lazy loading, sizes, priority, zero CLS).
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  unoptimized,
  fallback,
  onError,
  className = '',
  style,
  ...rest
}) => {
  const [hasTransformationError, setHasTransformationError] = useState(false);
  const [hasTotalFailure, setHasTotalFailure] = useState(false);

  // Auto-detect if this source should be unoptimized by default
  const isAutoUnoptimized = useMemo(() => shouldBypassOptimization(src), [src]);

  // If user passed unoptimized=true, or auto-detected, or an optimization error occurred
  const effectiveUnoptimized = Boolean(unoptimized || isAutoUnoptimized || hasTransformationError);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // If the image failed while optimized, first attempt direct unoptimized fallback
    if (!effectiveUnoptimized && !hasTransformationError) {
      console.warn(
        `[SafeImage] Vercel optimization failed for "${typeof src === 'string' ? src : 'asset'}". Falling back to direct unoptimized delivery.`,
      );
      setHasTransformationError(true);
      return;
    }

    // If it failed even in unoptimized mode, it's a total network/resource failure
    setHasTotalFailure(true);
    if (onError) onError(e);
  };

  if (hasTotalFailure) {
    if (fallback) return <>{fallback}</>;

    return (
      <div
        className={`safe-image-fallback ${className}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-dim)',
          padding: '0.75rem',
          minWidth: rest.width ? `${rest.width}px` : '48px',
          minHeight: rest.height ? `${rest.height}px` : '48px',
          fontSize: '0.75rem',
          ...style,
        }}
        role="img"
        aria-label={alt || 'Image unavailable'}
      >
        <FileQuestion className="w-5 h-5 text-slate-500 mb-1" />
        <span style={{ fontSize: '0.7rem' }}>{alt || 'Asset unavailable'}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      unoptimized={effectiveUnoptimized}
      onError={handleError}
      className={className}
      style={style}
      {...rest}
    />
  );
};

export default SafeImage;
