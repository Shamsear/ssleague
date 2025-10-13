/**
 * IST Timezone Utility
 * 
 * Provides utility functions to ensure all timestamps are handled in IST (Indian Standard Time)
 * across Firebase and Neon databases.
 * 
 * IST is UTC+5:30
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Get current date/time in IST
 */
export function getISTNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Convert any date to IST Date object
 */
export function toIST(date: Date | string | number): Date {
  const d = new Date(date);
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Create a Firebase Timestamp in IST
 * This should be used when creating new documents
 */
export function createISTTimestamp(): Timestamp {
  const istNow = getISTNow();
  return Timestamp.fromDate(istNow);
}

/**
 * Convert a Firebase Timestamp to IST Date
 */
export function timestampToIST(timestamp: Timestamp): Date {
  return toIST(timestamp.toDate());
}

/**
 * Parse a date string as IST (YYYY-MM-DD format)
 * Assumes the date is already in IST timezone
 */
export function parseISTDate(dateString: string): Date {
  // Append IST timezone offset to ensure correct parsing
  return new Date(dateString + 'T00:00:00+05:30');
}

/**
 * Format a date as IST date string (YYYY-MM-DD)
 */
export function formatISTDate(date: Date): string {
  const istDate = toIST(date);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date as IST time string (HH:MM)
 */
export function formatISTTime(date: Date): string {
  const istDate = toIST(date);
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a date as IST datetime string (YYYY-MM-DD HH:MM:SS)
 */
export function formatISTDateTime(date: Date): string {
  const istDate = toIST(date);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  const seconds = String(istDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Create a Date object from IST date and time strings
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM format (optional, defaults to 00:00)
 */
export function createISTDateTime(dateString: string, timeString: string = '00:00'): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = parseISTDate(dateString);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Convert IST Date to ISO string for Neon database storage
 * Neon/PostgreSQL stores timestamps with timezone info
 */
export function toNeonTimestamp(date: Date): string {
  // Convert to IST and format as ISO string with timezone
  const istDate = toIST(date);
  return istDate.toISOString();
}

/**
 * Parse a Neon timestamp string to IST Date
 */
export function fromNeonTimestamp(timestamp: string): Date {
  return toIST(new Date(timestamp));
}

/**
 * Get today's date in IST as YYYY-MM-DD string
 */
export function getISTToday(): string {
  return formatISTDate(getISTNow());
}

/**
 * Compare two dates in IST timezone
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareISTDates(date1: Date, date2: Date): number {
  const ist1 = toIST(date1).getTime();
  const ist2 = toIST(date2).getTime();
  
  if (ist1 < ist2) return -1;
  if (ist1 > ist2) return 1;
  return 0;
}

/**
 * Check if a date is in the past (IST)
 */
export function isISTDatePast(date: Date): boolean {
  return compareISTDates(date, getISTNow()) < 0;
}

/**
 * Check if a date is in the future (IST)
 */
export function isISTDateFuture(date: Date): boolean {
  return compareISTDates(date, getISTNow()) > 0;
}

/**
 * Get time difference in minutes between two dates (IST)
 */
export function getISTMinutesDiff(date1: Date, date2: Date): number {
  const ist1 = toIST(date1).getTime();
  const ist2 = toIST(date2).getTime();
  return Math.floor((ist2 - ist1) / (1000 * 60));
}

/**
 * Get time difference in hours between two dates (IST)
 */
export function getISTHoursDiff(date1: Date, date2: Date): number {
  const ist1 = toIST(date1).getTime();
  const ist2 = toIST(date2).getTime();
  return Math.floor((ist2 - ist1) / (1000 * 60 * 60));
}

/**
 * Get time difference in days between two dates (IST)
 */
export function getISTDaysDiff(date1: Date, date2: Date): number {
  const ist1 = toIST(date1);
  const ist2 = toIST(date2);
  
  // Reset time to start of day for accurate day difference
  ist1.setHours(0, 0, 0, 0);
  ist2.setHours(0, 0, 0, 0);
  
  return Math.floor((ist2.getTime() - ist1.getTime()) / (1000 * 60 * 60 * 24));
}
