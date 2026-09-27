import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number | ReactNode;
  icon: LucideIcon;
  change?: {
    value: string;
    type: 'increase' | 'decrease' | 'neutral';
  };
  description?: string;
  loading?: boolean;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  description,
  loading = false 
}: StatCardProps) {
  const getChangeColor = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-destructive';
      case 'neutral':
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted rounded-xl p-8 border-0">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 bg-muted-foreground/10 rounded w-20" />
              <div className="h-8 bg-muted-foreground/10 rounded w-16" />
            </div>
            <div className="h-10 w-10 bg-muted-foreground/10 rounded-lg" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-muted rounded-xl p-8 border-0">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="h-10 w-10 bg-muted-foreground/10 rounded-lg flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      
      {(change || description) && (
        <div className="mt-4 flex items-center justify-between">
          {change && (
            <span className={`text-sm font-medium ${getChangeColor(change.type)}`}>
              {change.value}
            </span>
          )}
          {description && (
            <span className="text-sm text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    </Card>
  );
}
