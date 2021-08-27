// Copyright (C) 2021 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-temporal.calendar.prototype.monthdayfromfields
includes: [propertyHelper.js]
features: [Temporal]
---*/

assert.sameValue(
  typeof Temporal.Calendar.prototype.monthDayFromFields,
  "function",
  "`typeof Calendar.prototype.monthDayFromFields` is `function`"
);

verifyProperty(Temporal.Calendar.prototype, "monthDayFromFields", {
  writable: true,
  enumerable: false,
  configurable: true,
});