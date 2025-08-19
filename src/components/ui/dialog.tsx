import React from 'react';

export function Dialog({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

export function DialogTrigger({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

export function DialogContent({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

export function DialogHeader({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

export function DialogTitle({ children }: React.PropsWithChildren) {
  return <h2>{children}</h2>;
}

export function DialogFooter({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

