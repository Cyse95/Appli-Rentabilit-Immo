import * as React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...props }: InputProps) {
  // classes par défaut + possibilité d’en ajouter
  return <input className={`w-full border rounded-2xl px-3 py-2 ${className}`} {...props} />;
}
