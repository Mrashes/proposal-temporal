import { ES } from './ecmascript.mjs';
import { GetIntrinsic } from './intrinsicclass.mjs';
import {
  GetSlot,
  INSTANT,
  ISO_YEAR,
  ISO_MONTH,
  ISO_DAY,
  ISO_HOUR,
  ISO_MINUTE,
  ISO_SECOND,
  ISO_MILLISECOND,
  ISO_MICROSECOND,
  ISO_NANOSECOND,
  CALENDAR,
  TIME_ZONE
} from './slots.mjs';
import { TimeZone } from './timezone.mjs';

const DATE = Symbol('date');
const YM = Symbol('ym');
const MD = Symbol('md');
const TIME = Symbol('time');
const DATETIME = Symbol('datetime');
const ZONED = Symbol('zoneddatetime');
const INST = Symbol('instant');
const ORIGINAL = Symbol('original');
const TZ_RESOLVED = Symbol('timezone');
const TZ_GIVEN = Symbol('timezone-id-given');
const CAL_ID = Symbol('calendar-id');

const descriptor = (value) => {
  return {
    value,
    enumerable: true,
    writable: false,
    configurable: true
  };
};

const IntlDateTimeFormat = globalThis.Intl.DateTimeFormat;
const ObjectAssign = Object.assign;

export function DateTimeFormat(locale = IntlDateTimeFormat().resolvedOptions().locale, options = {}) {
  if (!(this instanceof DateTimeFormat)) return new DateTimeFormat(locale, options);

  this[TZ_GIVEN] = options.timeZone ? options.timeZone : null;

  this[ORIGINAL] = new IntlDateTimeFormat(locale, options);
  this[TZ_RESOLVED] = new TimeZone(this.resolvedOptions().timeZone);
  this[CAL_ID] = this.resolvedOptions().calendar;
  this[DATE] = new IntlDateTimeFormat(locale, dateAmend(options));
  this[YM] = new IntlDateTimeFormat(locale, yearMonthAmend(options));
  this[MD] = new IntlDateTimeFormat(locale, monthDayAmend(options));
  this[TIME] = new IntlDateTimeFormat(locale, timeAmend(options));
  this[DATETIME] = new IntlDateTimeFormat(locale, datetimeAmend(options));
  this[ZONED] = new IntlDateTimeFormat(locale, zonedDateTimeAmend(options));
  this[INST] = new IntlDateTimeFormat(locale, instantAmend(options));
}

DateTimeFormat.supportedLocalesOf = function (...args) {
  return IntlDateTimeFormat.supportedLocalesOf(...args);
};

const properties = {
  resolvedOptions: descriptor(resolvedOptions),
  format: descriptor(format),
  formatRange: descriptor(formatRange)
};

if ('formatToParts' in IntlDateTimeFormat.prototype) {
  properties.formatToParts = descriptor(formatToParts);
}

if ('formatRangeToParts' in IntlDateTimeFormat.prototype) {
  properties.formatRangeToParts = descriptor(formatRangeToParts);
}

DateTimeFormat.prototype = Object.create(IntlDateTimeFormat.prototype, properties);

function resolvedOptions() {
  return this[ORIGINAL].resolvedOptions();
}

function adjustFormatterTimeZone(formatter, timeZone) {
  if (!timeZone) return formatter;
  const options = formatter.resolvedOptions();
  return new IntlDateTimeFormat(options.locale, { ...options, timeZone });
}

function format(datetime, ...rest) {
  let { instant, formatter, timeZone } = extractOverrides(datetime, this);
  if (instant && formatter) {
    formatter = adjustFormatterTimeZone(formatter, timeZone);
    return formatter.format(instant.epochMilliseconds);
  }
  return this[ORIGINAL].format(datetime, ...rest);
}

function formatToParts(datetime, ...rest) {
  let { instant, formatter, timeZone } = extractOverrides(datetime, this);
  if (instant && formatter) {
    formatter = adjustFormatterTimeZone(formatter, timeZone);
    return formatter.formatToParts(instant.epochMilliseconds);
  }
  return this[ORIGINAL].formatToParts(datetime, ...rest);
}

function formatRange(a, b) {
  if (ES.Type(a) === 'Object' && ES.Type(b) === 'Object') {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
      throw new TypeError('Intl.DateTimeFormat accepts two values of the same type');
    }
    const { instant: aa, formatter: aformatter, timeZone: atz } = extractOverrides(a, this);
    const { instant: bb, formatter: bformatter, timeZone: btz } = extractOverrides(b, this);
    if (atz && btz && ES.TimeZoneToString(atz) !== ES.TimeZoneToString(btz)) {
      throw new RangeError('cannot format range between different time zones');
    }
    if (aa && bb && aformatter && bformatter && aformatter === bformatter) {
      const formatter = adjustFormatterTimeZone(aformatter, atz);
      return formatter.formatRange(aa.epochMilliseconds, bb.epochMilliseconds);
    }
  }
  return this[ORIGINAL].formatRange(a, b);
}

function formatRangeToParts(a, b) {
  if (ES.Type(a) === 'Object' && ES.Type(b) === 'Object') {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
      throw new TypeError('Intl.DateTimeFormat accepts two values of the same type');
    }
    const { instant: aa, formatter: aformatter, timeZone: atz } = extractOverrides(a, this);
    const { instant: bb, formatter: bformatter, timeZone: btz } = extractOverrides(b, this);
    if (atz && btz && ES.TimeZoneToString(atz) !== ES.TimeZoneToString(btz)) {
      throw new RangeError('cannot format range between different time zones');
    }
    if (aa && bb && aformatter && bformatter && aformatter === bformatter) {
      const formatter = adjustFormatterTimeZone(aformatter, atz);
      return formatter.formatRangeToParts(aa.epochMilliseconds, bb.epochMilliseconds);
    }
  }
  return this[ORIGINAL].formatRangeToParts(a, b);
}

function amend(options = {}, amended = {}) {
  options = ObjectAssign({}, options);
  for (let opt of ['year', 'month', 'day', 'hour', 'minute', 'second', 'weekday', 'timeZoneName']) {
    options[opt] = opt in amended ? amended[opt] : options[opt];
    if (options[opt] === false || options[opt] === undefined) delete options[opt];
  }
  return options;
}

function timeAmend(options) {
  options = amend(options, { year: false, month: false, day: false, weekday: false, timeZoneName: false });
  if (!hasTimeOptions(options)) {
    options = ObjectAssign({}, options, {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    });
  }
  return options;
}

function yearMonthAmend(options) {
  options = amend(options, {
    day: false,
    hour: false,
    minute: false,
    second: false,
    weekday: false,
    timeZoneName: false
  });
  if (!('year' in options || 'month' in options)) {
    options = ObjectAssign(options, { year: 'numeric', month: 'numeric' });
  }
  return options;
}

function monthDayAmend(options) {
  options = amend(options, {
    year: false,
    hour: false,
    minute: false,
    second: false,
    weekday: false,
    timeZoneName: false
  });
  if (!('month' in options || 'day' in options)) {
    options = ObjectAssign({}, options, { month: 'numeric', day: 'numeric' });
  }
  return options;
}

function dateAmend(options) {
  options = amend(options, { hour: false, minute: false, second: false, timeZoneName: false });
  if (!hasDateOptions(options)) {
    options = ObjectAssign({}, options, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  }
  return options;
}

function datetimeAmend(options) {
  options = amend(options, { timeZoneName: false });
  if (!hasTimeOptions(options) && !hasDateOptions(options)) {
    options = ObjectAssign({}, options, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    });
  }
  return options;
}

function zonedDateTimeAmend(options) {
  if (!hasTimeOptions(options) && !hasDateOptions(options)) {
    options = ObjectAssign({}, options, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    });
    if (options.timeZoneName === undefined) options.timeZoneName = 'short';
  }
  return options;
}

function instantAmend(options) {
  if (!hasTimeOptions(options) && !hasDateOptions(options)) {
    options = ObjectAssign({}, options, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    });
  }
  return options;
}

function hasDateOptions(options) {
  return 'year' in options || 'month' in options || 'day' in options || 'weekday' in options;
}

function hasTimeOptions(options) {
  return 'hour' in options || 'minute' in options || 'second' in options;
}

function extractOverrides(temporalObj, main) {
  const DateTime = GetIntrinsic('%Temporal.PlainDateTime%');

  if (ES.IsTemporalTime(temporalObj)) {
    const hour = GetSlot(temporalObj, ISO_HOUR);
    const minute = GetSlot(temporalObj, ISO_MINUTE);
    const second = GetSlot(temporalObj, ISO_SECOND);
    const millisecond = GetSlot(temporalObj, ISO_MILLISECOND);
    const microsecond = GetSlot(temporalObj, ISO_MICROSECOND);
    const nanosecond = GetSlot(temporalObj, ISO_NANOSECOND);
    const datetime = new DateTime(1970, 1, 1, hour, minute, second, millisecond, microsecond, nanosecond, main[CAL_ID]);
    return {
      instant: main[TZ_RESOLVED].getInstantFor(datetime),
      formatter: main[TIME]
    };
  }

  if (ES.IsTemporalYearMonth(temporalObj)) {
    const isoYear = GetSlot(temporalObj, ISO_YEAR);
    const isoMonth = GetSlot(temporalObj, ISO_MONTH);
    const referenceISODay = GetSlot(temporalObj, ISO_DAY);
    const calendar = ES.CalendarToString(GetSlot(temporalObj, CALENDAR));
    if (calendar !== main[CAL_ID]) {
      throw new RangeError(
        `cannot format PlainYearMonth with calendar ${calendar} in locale with calendar ${main[CAL_ID]}`
      );
    }
    const datetime = new DateTime(isoYear, isoMonth, referenceISODay, 12, 0, 0, 0, 0, 0, calendar);
    return {
      instant: main[TZ_RESOLVED].getInstantFor(datetime),
      formatter: main[YM]
    };
  }

  if (ES.IsTemporalMonthDay(temporalObj)) {
    const referenceISOYear = GetSlot(temporalObj, ISO_YEAR);
    const isoMonth = GetSlot(temporalObj, ISO_MONTH);
    const isoDay = GetSlot(temporalObj, ISO_DAY);
    const calendar = ES.CalendarToString(GetSlot(temporalObj, CALENDAR));
    if (calendar !== main[CAL_ID]) {
      throw new RangeError(
        `cannot format PlainMonthDay with calendar ${calendar} in locale with calendar ${main[CAL_ID]}`
      );
    }
    const datetime = new DateTime(referenceISOYear, isoMonth, isoDay, 12, 0, 0, 0, 0, 0, calendar);
    return {
      instant: main[TZ_RESOLVED].getInstantFor(datetime),
      formatter: main[MD]
    };
  }

  if (ES.IsTemporalDate(temporalObj)) {
    const isoYear = GetSlot(temporalObj, ISO_YEAR);
    const isoMonth = GetSlot(temporalObj, ISO_MONTH);
    const isoDay = GetSlot(temporalObj, ISO_DAY);
    const calendar = ES.CalendarToString(GetSlot(temporalObj, CALENDAR));
    if (calendar !== 'iso8601' && calendar !== main[CAL_ID]) {
      throw new RangeError(`cannot format PlainDate with calendar ${calendar} in locale with calendar ${main[CAL_ID]}`);
    }
    const datetime = new DateTime(isoYear, isoMonth, isoDay, 12, 0, 0, 0, 0, 0, main[CAL_ID]);
    return {
      instant: main[TZ_RESOLVED].getInstantFor(datetime),
      formatter: main[DATE]
    };
  }

  if (ES.IsTemporalDateTime(temporalObj)) {
    const isoYear = GetSlot(temporalObj, ISO_YEAR);
    const isoMonth = GetSlot(temporalObj, ISO_MONTH);
    const isoDay = GetSlot(temporalObj, ISO_DAY);
    const hour = GetSlot(temporalObj, ISO_HOUR);
    const minute = GetSlot(temporalObj, ISO_MINUTE);
    const second = GetSlot(temporalObj, ISO_SECOND);
    const millisecond = GetSlot(temporalObj, ISO_MILLISECOND);
    const microsecond = GetSlot(temporalObj, ISO_MICROSECOND);
    const nanosecond = GetSlot(temporalObj, ISO_NANOSECOND);
    const calendar = ES.CalendarToString(GetSlot(temporalObj, CALENDAR));
    if (calendar !== 'iso8601' && calendar !== main[CAL_ID]) {
      throw new RangeError(
        `cannot format PlainDateTime with calendar ${calendar} in locale with calendar ${main[CAL_ID]}`
      );
    }
    let datetime = temporalObj;
    if (calendar === 'iso8601') {
      datetime = new DateTime(
        isoYear,
        isoMonth,
        isoDay,
        hour,
        minute,
        second,
        millisecond,
        microsecond,
        nanosecond,
        main[CAL_ID]
      );
    }
    return {
      instant: main[TZ_RESOLVED].getInstantFor(datetime),
      formatter: main[DATETIME]
    };
  }

  if (ES.IsTemporalZonedDateTime(temporalObj)) {
    const calendar = ES.CalendarToString(GetSlot(temporalObj, CALENDAR));
    if (calendar !== 'iso8601' && calendar !== main[CAL_ID]) {
      throw new RangeError(
        `cannot format ZonedDateTime with calendar ${calendar} in locale with calendar ${main[CAL_ID]}`
      );
    }

    let timeZone = GetSlot(temporalObj, TIME_ZONE);
    const objTimeZone = ES.TimeZoneToString(timeZone);
    if (main[TZ_GIVEN] && main[TZ_GIVEN] !== objTimeZone) {
      throw new RangeError(`timeZone option ${main[TZ_GIVEN]} doesn't match actual time zone ${objTimeZone}`);
    }

    return {
      instant: GetSlot(temporalObj, INSTANT),
      formatter: main[ZONED],
      timeZone
    };
  }

  if (ES.IsTemporalInstant(temporalObj)) {
    return {
      instant: temporalObj,
      formatter: main[INST]
    };
  }

  return {};
}