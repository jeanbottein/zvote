import type { ReactNode } from 'react';

interface NoticeProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** A page-sized message: nothing found, something failed, something is gone. */
export default function Notice({ title, children, action }: NoticeProps) {
  return (
    <section className="panel notice">
      <title>{`${title} · zvote`}</title>
      <h1>{title}</h1>
      {children && <div className="notice-text">{children}</div>}
      {action}
    </section>
  );
}
