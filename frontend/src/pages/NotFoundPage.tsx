import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

/**
 * 404 page.
 */
export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <FileQuestion className="mb-4 h-14 w-14 text-navy-300" aria-hidden />
      <h1 className="mb-2 text-3xl font-bold">Page not found</h1>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-navy-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-navy-800"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
