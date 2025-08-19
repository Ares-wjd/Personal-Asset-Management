import React from 'react';

export function Select({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

export function SelectTrigger({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

export function SelectValue(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} />;
}

export function SelectContent({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

export function SelectItem({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

