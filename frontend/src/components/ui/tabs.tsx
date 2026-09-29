'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex flex-wrap gap-2 border-b border-slate-700 pb-2', className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn('rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-all outline-none hover:bg-slate-800 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300', className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
