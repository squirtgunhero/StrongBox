import { format, formatDistanceToNow, isAfter, isBefore } from "date-fns";

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy h:mm a");
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function isOverdue(date: Date | string): boolean {
  return isBefore(new Date(date), new Date());
}

export function isUpcoming(date: Date | string, withinDays: number): boolean {
  const target = new Date(date);
  const now = new Date();
  const threshold = new Date(now.getTime() + withinDays * 86400000);
  return isAfter(target, now) && isBefore(target, threshold);
}
