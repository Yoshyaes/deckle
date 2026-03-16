'use client';

import { useEffect, useMemo } from 'react';

type ErrorCategory = 'network' | 'auth' | 'not_found' | 'generic';

function categorizeError(error: Error & { digest?: string }): ErrorCategory {
  const message = error.message?.toLowerCase() || '';
  const digest = error.digest?.toLowerCase() || '';

  // Network errors
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('failed to load') ||
    message.includes('timeout') ||
    message.includes('abort')
  ) {
    return 'network';
  }

  // Auth errors
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication') ||
    digest.includes('unauthorized')
  ) {
    return 'auth';
  }

  // Not found errors
  if (
    message.includes('404') ||
    message.includes('not found') ||
    digest.includes('not_found')
  ) {
    return 'not_found';
  }

  return 'generic';
}

const ERROR_CONFIG: Record<
  ErrorCategory,
  { icon: string; title: string; description: string; action: string }
> = {
  network: {
    icon: '&#9888;',
    title: 'Connection Issue',
    description:
      'Unable to reach the server. Please check your internet connection and try again.',
    action: 'Retry',
  },
  auth: {
    icon: '&#128274;',
    title: 'Authentication Required',
    description:
      'Your session may have expired or you do not have permission to access this resource.',
    action: 'Sign In',
  },
  not_found: {
    icon: '&#128269;',
    title: 'Not Found',
    description:
      'The page or resource you are looking for does not exist or has been removed.',
    action: 'Go Home',
  },
  generic: {
    icon: '&#9888;',
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Our team has been notified.',
    action: 'Try Again',
  },
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const category = useMemo(() => categorizeError(error), [error]);
  const config = ERROR_CONFIG[category];

  useEffect(() => {
    // Log the error for debugging
    console.error('[Dashboard Error]', { category, message: error.message, digest: error.digest });
  }, [error, category]);

  const handleAction = () => {
    switch (category) {
      case 'auth':
        window.location.href = '/sign-in';
        break;
      case 'not_found':
        window.location.href = '/';
        break;
      default:
        reset();
        break;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] text-white">
      <div className="text-center max-w-md px-6">
        <div
          className="text-4xl mb-4"
          dangerouslySetInnerHTML={{ __html: config.icon }}
        />
        <h2 className="text-xl font-semibold mb-2">{config.title}</h2>
        <p className="text-gray-400 mb-2 text-sm">{config.description}</p>
        {error.message && category === 'generic' && (
          <p className="text-gray-500 text-xs mb-4 font-mono break-all">
            {error.message}
          </p>
        )}
        {error.digest && (
          <p className="text-gray-600 text-xs mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={handleAction}
            className="px-5 py-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white text-sm font-semibold hover:from-orange-400 hover:to-orange-500 transition-colors"
          >
            {config.action}
          </button>
          {category !== 'generic' && (
            <button
              onClick={reset}
              className="px-5 py-2 rounded-lg border border-white/10 text-gray-400 text-sm font-medium hover:border-white/20 hover:text-gray-300 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
