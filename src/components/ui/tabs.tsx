import React from 'react';

export function Tabs({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

export function TabsList({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

export function TabsTrigger({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>;
}

export function TabsContent({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

