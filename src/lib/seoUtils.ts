import { subDays, subMonths, startOfMonth, endOfMonth, differenceInDays, format, parseISO, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export type DatePreset = 'rolling_7d' | 'last_week' | 'last_28_days' | 'last_month' | 'last_3_months' | 'custom';

export function getDatePresetRange(preset: DatePreset, custom?: DateRange): DateRange {
  const today = new Date();
  let start: Date;
  let end: Date = today;

  switch (preset) {
    case 'rolling_7d':
      // Matches Master Dashboard Rolling 7D (Accounting for GSC 3-day lag)
      end = subDays(today, 3);
      start = subDays(end, 6);
      break;
    case 'last_week':
      // Matches Master Dashboard Last Week (Mon-Sun)
      const lastWeekDate = subWeeks(today, 1);
      start = startOfWeek(lastWeekDate, { weekStartsOn: 1 });
      end = endOfWeek(lastWeekDate, { weekStartsOn: 1 });
      break;
    case 'last_28_days':
      start = subDays(today, 28);
      break;
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      start = startOfMonth(lastMonth);
      end = endOfMonth(lastMonth);
      break;
    case 'last_3_months':
      start = subDays(today, 90);
      break;
    case 'custom':
      if (custom) return custom;
      start = subDays(today, 7);
      break;
    default:
      start = subDays(today, 7);
  }

  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

export function getPreviousPeriod(range: DateRange): DateRange {
  const start = parseISO(range.startDate);
  const end = parseISO(range.endDate);
  const daysDiff = differenceInDays(end, start) + 1;

  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, daysDiff - 1);

  return {
    startDate: format(prevStart, 'yyyy-MM-dd'),
    endDate: format(prevEnd, 'yyyy-MM-dd'),
  };
}

export interface ComparisonResult {
  current: number;
  previous: number | null;
  difference: number | null;
  percentChange: number | null;
  status: 'improvement' | 'decline' | 'stable' | 'no_data';
}

export function calculateMetricComparison(
  current: number,
  previous: number | null | undefined,
  higherIsBetter: boolean = true
): ComparisonResult {
  if (previous === null || previous === undefined) {
    return { current, previous: null, difference: null, percentChange: null, status: 'no_data' };
  }

  const diff = current - previous;
  const percentChange = previous !== 0 ? (diff / previous) * 100 : 0;
  
  let status: 'improvement' | 'decline' | 'stable' | 'no_data' = 'stable';
  if (diff > 0) status = higherIsBetter ? 'improvement' : 'decline';
  if (diff < 0) status = higherIsBetter ? 'decline' : 'improvement';

  return { current, previous, difference: diff, percentChange, status };
}

export function calculatePositionComparison(
  current: number,
  previous: number | null | undefined
): ComparisonResult {
  // Lower position is better (1 is better than 10)
  return calculateMetricComparison(current, previous, false);
}
