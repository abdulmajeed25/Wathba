import { redirect } from 'next/navigation';

/**
 * Root → `/projects` redirect.  Wathba's app shell lives entirely under
 * `/projects/*`; there is no marketing root.
 */
export default function RootPage() {
  redirect('/projects');
}
