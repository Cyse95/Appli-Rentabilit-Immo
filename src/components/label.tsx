import * as React from 'react';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className = '', ...props }: LabelProps) {
  return <label className={`text-xs text-gray-600 ${className}`} {...props} />;
}
