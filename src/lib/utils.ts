import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string, locale = 'fr-FR') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date, locale = 'fr-FR') {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date))
}
