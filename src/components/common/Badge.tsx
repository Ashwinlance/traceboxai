import type { ReactNode } from 'react';

export function Badge({ children, tone='slate' }: { children: ReactNode; tone?: 'green'|'amber'|'red'|'blue'|'slate'|'purple' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
