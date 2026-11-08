import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCalScheduler, currentCalAppointment} from './cal-scheduler.mjs';

test('the result follows verified Cal replacements and recognizes cancellation', async () => {
  const bookings = {
    original: {uid:'original', status:'cancelled', rescheduledToUid:'moved'},
    moved: {uid:'moved', status:'accepted', rescheduledFromUid:'original', start:'2026-11-09T16:00:00Z'},
  };
  const readBooking = async uid => bookings[uid];
  assert.deepEqual(await currentCalAppointment('original', readBooking), {startsAt:bookings.moved.start});
  bookings.moved.status = 'cancelled';
  assert.deepEqual(await currentCalAppointment('original', readBooking), {appointmentStatus:'cancelled'});
  bookings.moved.rescheduledFromUid = 'unrelated';
  await assert.rejects(currentCalAppointment('original', readBooking), /Unexpected Cal.com replacement/);
});

const eventId=7783830, start='2026-11-11T11:00:00.000Z', now=()=>Date.parse('2026-11-05T10:00:00Z');
const event={id:eventId,lengthInMinutes:60,confirmationPolicy:{type:'always',blockUnconfirmedBookingsInBooker:true},
  bookingFields:[{slug:'name',required:true},{slug:'email',required:true},
    {type:'select',slug:'payment-choice',required:true,options:['PLN','BTC']}]};
function fixture(overrides={}) {
  const calls=[];
  const scheduler=createCalScheduler({apiKey:'fixture',eventId,now,request:async(url,options)=> {
    calls.push({url,options});
    if(url.includes('/event-types/'))return Response.json({status:'success',data:overrides.event||event});
    if(url.includes('/slots?'))return Response.json({status:'success',data:{'2026-11-11':overrides.slots??[{start:'2026-11-11T12:00:00+01:00'}]}});
    if(overrides.post)return overrides.post();
    const body=JSON.parse(options.body);
    return Response.json({status:'success',data:{uid:'native-booking',eventTypeId:eventId,status:'pending',duration:60,start:body.start}});
  }});
  return {scheduler,calls};
}
const input=locale=>({locale,name:'Jan Kowalski',email:'jan@example.test',notes:'Tematy rozmowy',timeZone:'Europe/Warsaw',start});

test('native booking sends selected attendee language and exact existing payment field without bypassing Cal rules',async()=> {
  for(const locale of ['en','pl']) {
    const {scheduler,calls}=fixture();
    const prepared=await scheduler.prepare(input(locale));
    const booking=await scheduler.book(prepared);
    assert.equal(booking.status,'pending');
    const request=calls.find(call=>call.options.method==='POST');
    const body=JSON.parse(request.options.body);
    assert.equal(body.attendee.language,locale);
    assert.equal(body.attendee.timeZone,'Europe/Warsaw');
    assert.equal(body.bookingFieldsResponses['payment-choice'],'PLN');
    assert.equal(body.eventTypeId,eventId);
    for(const key of ['allowConflicts','allowBookingOutOfBounds','skipBookingLimits'])assert.equal(key in body,false);
    assert.equal(request.options.headers['cal-api-version'],'2026-02-25');
  }
});

test('changed confirmation policy and newly unavailable slots fail before booking creation',async()=> {
  for(const overrides of [{event:{...event,confirmationPolicy:{disabled:true}}},{slots:[]}]) {
    const {scheduler,calls}=fixture(overrides);
    await assert.rejects(()=>scheduler.prepare(input('pl')));
    assert.equal(calls.some(call=>call.options.method==='POST'),false);
  }
});

test('invalid attendee input, timezone and oversized availability ranges are rejected',async()=> {
  const {scheduler}=fixture();
  await assert.rejects(()=>scheduler.prepare({...input('pl'),email:'bad'}),{code:'INVALID_INPUT'});
  await assert.rejects(()=>scheduler.prepare({...input('pl'),locale:'de'}),{code:'INVALID_INPUT'});
  await assert.rejects(()=>scheduler.availability({start,end:'2027-02-01',timeZone:'UTC'}),{code:'INVALID_INPUT'});
  await assert.rejects(()=>scheduler.availability({start,end:'2026-11-12',timeZone:'not-a-zone'}),{code:'INVALID_INPUT'});
});

test('ambiguous creation failures require review, while definite conflicts can safely retry',async()=> {
  const ambiguous=fixture({post:()=>Response.json({}, {status:500})}).scheduler;
  await assert.rejects(()=>ambiguous.book({start}),error=>error.uncertain===true);
  const rejected=fixture({post:()=>Response.json({}, {status:409})}).scheduler;
  await assert.rejects(()=>rejected.book({start}),error=>error.code==='BOOKING_REJECTED' && error.uncertain===false);
});
