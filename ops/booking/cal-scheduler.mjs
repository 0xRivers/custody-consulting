export class SchedulingError extends Error {
  constructor(code, status = 409, uncertain = false) {
    super(code); this.code = code; this.status = status; this.uncertain = uncertain;
  }
}

export async function currentCalAppointment(reference, readBooking) {
  const seen = new Set();
  let booking = await readBooking(reference);
  while (booking.rescheduledToUid) {
    seen.add(booking.uid);
    const next = booking.rescheduledToUid;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(next) || seen.has(next) || seen.size >= 10) {
      throw new Error('Invalid Cal.com reschedule chain.');
    }
    const replacement = await readBooking(next);
    if (replacement.rescheduledFromUid !== booking.uid) throw new Error('Unexpected Cal.com replacement.');
    booking = replacement;
  }
  if (booking.status === 'cancelled') return {appointmentStatus:'cancelled'};
  if (booking.status === 'accepted' && Number.isFinite(Date.parse(booking.start))) {
    return {startsAt:booking.start};
  }
  return {};
}

export function createCalScheduler({ apiKey, eventId, request = fetch, now = Date.now }) {
  if (!Number.isSafeInteger(eventId) || eventId <= 0 || eventId === 7772427) throw new Error('Discovery is excluded.');
  async function api(path, version, body) {
    let response;
    try {
      response = await request('https://api.cal.com/v2' + path, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': version,
          ...(body ? {'Content-Type':'application/json'} : {}) },
        ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(15000),
      });
    } catch { throw new SchedulingError('CAL_UNAVAILABLE', 503, !!body); }
    if (!response.ok) {
      const rejected = !!body && [400, 409, 422].includes(response.status);
      if (rejected && path === '/bookings') {
        // Cal can echo submitted values in errors. Log only fixed diagnostic labels.
        const detail = await response.text().catch(() => '');
        const hints = [
          ['location', /location/i],
          ['booking-field', /bookingFieldsResponses|booking field|how.would.you.like.to.pay/i],
          ['required-field', /required|missing|must be provided/i],
          ['attendee-email', /email/i],
          ['slot-conflict', /slot|already booked|unavailable|conflict/i],
          ['consent', /consent|terms|privacy policy/i],
          ['payment', /payment|stripe/i],
        ].filter(([, pattern]) => pattern.test(detail)).map(([label]) => label);
        console.warn('Cal booking rejected', JSON.stringify({
          eventId, upstreamStatus: response.status, hints,
        }));
      }
      throw new SchedulingError(
        rejected ? 'BOOKING_REJECTED' : 'CAL_UNAVAILABLE',
        rejected ? 409 : 503,
        !!body && response.status >= 500,
      );
    }
    try {
      const result = await response.json();
      if (result.status !== 'success' || !result.data) throw new Error();
      return result.data;
    } catch { throw new SchedulingError('CAL_UNAVAILABLE', 503, !!body); }
  }
  function zone(value) {
    if (typeof value !== 'string' || value.length > 100) throw new SchedulingError('INVALID_INPUT', 400);
    try { new Intl.DateTimeFormat('en', {timeZone:value}).format(); } catch { throw new SchedulingError('INVALID_INPUT', 400); }
    return value;
  }
  async function configuration(paymentMethod='PLN') {
    if(!['PLN','BTC'].includes(paymentMethod))throw new SchedulingError('INVALID_INPUT',400);
    const event = await api(`/event-types/${eventId}`, '2026-06-12');
    if (event.id !== eventId || event.lengthInMinutes !== 60 ||
        event.confirmationPolicy?.disabled || event.confirmationPolicy?.type !== 'always' ||
        event.confirmationPolicy?.blockUnconfirmedBookingsInBooker !== true) {
      throw new SchedulingError('EVENT_CONFIGURATION', 503);
    }
    const fields = event.bookingFields;
    if (!Array.isArray(fields)) throw new SchedulingError('EVENT_CONFIGURATION', 503);
    const payments = fields.filter(field => ['select', 'radio'].includes(field.type) && !field.hidden &&
      field.options?.some(option => typeof option === 'string' && /^(PLN|420 PLN(?:\s*[—–-].*)?)$/i.test(option.trim())));
    if (payments.length !== 1 || typeof payments[0].slug !== 'string') throw new SchedulingError('EVENT_CONFIGURATION', 503);
    const defaults = new Set(['name', 'email', 'location', 'notes', 'guests', 'rescheduleReason']);
    if (fields.some(field => field.required && !field.hidden && !defaults.has(field.slug) && field.slug !== payments[0].slug)) {
      throw new SchedulingError('EVENT_CONFIGURATION', 503);
    }
    const paymentValue=payments[0].options.find(option => paymentMethod==='BTC'?option.trim().toUpperCase()==='BTC':/^(PLN|420 PLN(?:\s*[—–-].*)?)$/i.test(option.trim()));
    if(!paymentValue)throw new SchedulingError('EVENT_CONFIGURATION',503);
    return {paymentSlug:payments[0].slug,paymentValue};
  }
  async function availability({ start, end, timeZone }) {
    const from = Date.parse(start), until = Date.parse(end);
    if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from || until - from > 34 * 86400_000 ||
        from < now() - 35 * 86400_000 || until > now() + 400 * 86400_000) throw new SchedulingError('INVALID_INPUT', 400);
    const query = new URLSearchParams({eventTypeId:String(eventId), start:new Date(from).toISOString(),
      end:new Date(until).toISOString(), timeZone:zone(timeZone)});
    const data = await api('/slots?' + query, '2024-09-04');
    const slots = [...new Set(Object.values(data).flatMap(list => Array.isArray(list) ? list : [])
      .map(slot => Date.parse(slot?.start)).filter(value => Number.isFinite(value) && value >= from && value < until && value > now() + 35 * 60_000))]
      .sort((a,b) => a-b).map(value => new Date(value).toISOString());
    return slots;
  }
  async function prepare(input) {
    const {locale, name, email, notes = '', start, timeZone} = input;
    if (!['en','pl'].includes(locale) || typeof name !== 'string' || !name.trim() || name.length > 150 ||
        typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof notes !== 'string' || notes.length > 1500 || !Number.isFinite(Date.parse(start)) ||
        Date.parse(start) <= now() + 35 * 60_000) throw new SchedulingError('INVALID_INPUT', 400);
    const config = await configuration(input.paymentMethod||'PLN');
    const canonicalStart = new Date(start).toISOString();
    const slots = await availability({start:canonicalStart, end:new Date(Date.parse(start) + 3600_000).toISOString(), timeZone});
    if (!slots.includes(canonicalStart)) throw new SchedulingError('SLOT_UNAVAILABLE');
    return {start:canonicalStart, eventTypeId:eventId, attendee:{name:name.trim(), email:email.trim(), timeZone:zone(timeZone), language:locale},
      bookingFieldsResponses:{[config.paymentSlug]:config.paymentValue, ...(notes.trim() ? {notes:notes.trim()} : {})}};
  }
  async function book(body) {
    const booking = await api('/bookings', '2026-02-25', body);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(booking.uid ?? '') || booking.eventTypeId !== eventId ||
        booking.status !== 'pending' || booking.duration !== 60 || Date.parse(booking.start) !== Date.parse(body.start)) {
      throw new SchedulingError('BOOKING_NEEDS_REVIEW', 503, true);
    }
    return booking;
  }
  return {availability, prepare, book, configuration};
}
