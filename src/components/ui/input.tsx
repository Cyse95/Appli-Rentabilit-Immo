import * as React from 'react'
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>
export function Input({ className, ...props }: InputProps) {
  return <input className={className} {...props} />
}