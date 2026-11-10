export const bookingCopy = {
  en: {
    testNote:'Private test booking · payment options are checked when the booking loads.',
    chooseTime:'Choose a day', localTime:'Your local time',
    reload:'Reload availability', chooseDay:'Choose an available day', yourDetails:'Your details',
    selectFirst:'Select a day and time to continue.', name:'Your name', email:'Email address',
    emailHelp:'Your meeting details will be sent here.', notes:'I have a specific question (optional)',
    payment:'Payment', paymentHelp:'Pay by card or an available local payment method at checkout.',
    bookingPolicy:'You can cancel or reschedule up to 12 hours before your appointment. You’ll receive a payment receipt.',
    terms:'Cal.com handles scheduling and confirmation emails. Your slot is confirmed after payment. Unpaid checkout expires after 35 minutes.',
    submit:'Continue to payment', resume:'Continue to payment', switchBTC:'Switch to BTC', switching:'Closing card checkout and opening BTC…', PAYMENT_SWITCH_BLOCKED:'This payment cannot be switched. It may already be processing or the booking may have changed. Please contact us before paying again.', previous:'Previous month', next:'Next month',
    loading:'Checking availability…', empty:'No available times this month. Try the next month.',
    ready:'Select a highlighted day to see available times.', creating:'Reserving your time and opening checkout…',
    opening:'Opening checkout…', saved:'Your booking request is awaiting payment.',
    invitation:'Open the full link from your private invitation to display the calendar.',
    failed:'We couldn’t complete that step. Check the booking status before trying again.',
    check:'Check booking status', contact:'Contact us',
    SLOT_UNAVAILABLE:'That time is no longer available. Please select another time.',
    BOOKING_REJECTED:'Cal.com could not reserve that time. Check your details and choose an available time.',
    INVALID_INPUT:'Please check your name, email address and selected time.',
    EVENT_CONFIGURATION:'Booking is temporarily unavailable. Please contact us.',
    BOOKING_NEEDS_REVIEW:'We need to check your booking before continuing. Please contact us; don’t create another booking.',
    INVITATION_EXPIRED:'This invitation has expired. Please contact us for a new invitation.',
    FORBIDDEN:'This invitation is missing, expired or invalid. Please contact us.',
    PAYMENT_UNAVAILABLE:'This payment method is not available yet. Please choose card payment or contact us.',
    testNoteBTC:'Test booking · choose card payment or BTC to continue to the selected checkout.',
  },
  pl: {
    testNote:'Prywatna rezerwacja testowa · dostępne metody płatności sprawdzimy po wczytaniu rezerwacji.',
    chooseTime:'Wybierz dzień', localTime:'Twój czas lokalny',
    reload:'Odśwież dostępność', chooseDay:'Wybierz dostępny dzień', yourDetails:'Twoje dane',
    selectFirst:'Wybierz dzień i godzinę, aby kontynuować.', name:'Imię i nazwisko', email:'Adres e-mail',
    emailHelp:'Na ten adres wyślemy szczegóły spotkania.', notes:'Mam konkretne pytanie (opcjonalnie)',
    payment:'Płatność', paymentHelp:'Zapłać kartą lub dostępną lokalną metodą płatności.',
    bookingPolicy:'Możesz odwołać konsultację lub zmienić jej termin najpóźniej 12 godzin przed spotkaniem. Otrzymasz potwierdzenie płatności.',
    terms:'Cal.com obsługuje rezerwacje i wiadomości z potwierdzeniem. Potwierdzimy termin po opłaceniu. Nieopłacona płatność wygasa po 35 minutach.',
    submit:'Przejdź do płatności', resume:'Przejdź do płatności', switchBTC:'Zmień na BTC', switching:'Zamykamy płatność kartą i otwieramy BTC…', PAYMENT_SWITCH_BLOCKED:'Nie możemy zmienić tej płatności. Może być już przetwarzana lub rezerwacja uległa zmianie. Skontaktuj się z nami przed ponowną płatnością.', previous:'Poprzedni miesiąc', next:'Następny miesiąc',
    loading:'Sprawdzamy dostępność…', empty:'Brak dostępnych terminów w tym miesiącu. Sprawdź następny miesiąc.',
    ready:'Wybierz wyróżniony dzień, aby zobaczyć dostępne godziny.', creating:'Rezerwujemy termin i otwieramy płatność…',
    opening:'Otwieranie płatności…', saved:'Twoja rezerwacja oczekuje na płatność.',
    invitation:'Otwórz pełny link z prywatnego zaproszenia, aby wyświetlić kalendarz.',
    failed:'Nie udało się zakończyć tego kroku. Sprawdź status rezerwacji przed ponowną próbą.',
    check:'Sprawdź status rezerwacji', contact:'Skontaktuj się z nami',
    SLOT_UNAVAILABLE:'Ten termin nie jest już dostępny. Wybierz inną godzinę.',
    BOOKING_REJECTED:'Cal.com nie może zarezerwować tego terminu. Sprawdź dane i wybierz dostępną godzinę.',
    INVALID_INPUT:'Sprawdź imię i nazwisko, adres e-mail oraz wybrany termin.',
    EVENT_CONFIGURATION:'Rezerwacja jest chwilowo niedostępna. Skontaktuj się z nami.',
    BOOKING_NEEDS_REVIEW:'Musimy sprawdzić Twoją rezerwację przed kontynuowaniem. Skontaktuj się z nami i nie twórz kolejnej rezerwacji.',
    INVITATION_EXPIRED:'Zaproszenie wygasło. Skontaktuj się z nami, aby otrzymać nowe.',
    FORBIDDEN:'Brakuje zaproszenia, zaproszenie wygasło lub jest nieprawidłowe. Skontaktuj się z nami.',
    PAYMENT_UNAVAILABLE:'Ta metoda płatności nie jest jeszcze dostępna. Wybierz płatność kartą lub skontaktuj się z nami.',
    testNoteBTC:'Rezerwacja testowa · wybierz płatność kartą lub BTC, aby przejść do wybranej płatności.',
  },
};

export function dateKey(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'})
    .formatToParts(new Date(instant));
  const part = type => parts.find(value => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function monthWindow(year, month) {
  // Extra UTC days cover the local month even in UTC+14 and UTC-12.
  return {start:new Date(Date.UTC(year, month, 1) - 86400_000).toISOString(),
    end:new Date(Date.UTC(year, month + 1, 1) + 86400_000).toISOString()};
}

export function mountFoundationBooking(env = {}) {
  const doc = env.document || globalThis.document;
  const location = env.location || globalThis.location;
  const history = env.history || globalThis.history;
  const request = env.fetch || globalThis.fetch;
  let storage;
  try { storage = env.storage || globalThis.sessionStorage; } catch {}
  const byId = id => doc.getElementById(id);
  const locale = new URL(location.href).searchParams.get('lang') === 'pl' ? 'pl' : 'en';
  const text = bookingCopy[locale], language = locale === 'pl' ? 'pl-PL' : 'en-GB';
  const validToken = value => /^[A-Za-z0-9_-]{43}$/.test(value || '');
  const supplied = new URLSearchParams(location.hash.slice(1)).get('invite');
  let invitation = supplied || '', reference, busy = false, selectedStart = '', selectedDay = '', slots = [];
  let loadVersion = 0;
  let lightningPilot = false;
  let initializedRetry = false;
  const prefix=location.pathname.startsWith('/lightning-pilot/')?'/lightning-pilot':'';
  const storageKey = 'custody-foundation-pilot'+prefix;
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (supplied === null && validToken(saved?.invitation)) invitation = saved.invitation;
    if (validToken(invitation) && saved?.invitation === invitation && /^[A-Za-z0-9_-]{1,100}$/.test(saved?.reference || '')) reference = saved.reference;
  } catch {}
  function save() {
    try {
      if (!storage) return;
      storage.setItem(storageKey, JSON.stringify({invitation, reference}));
      history.replaceState(null, '', location.pathname + location.search);
    } catch {}
  }
  if (validToken(invitation)) save();
  doc.documentElement.lang = locale;
  doc.querySelectorAll('[data-lang]').forEach(element => {element.hidden = element.dataset.lang !== locale;});
  doc.querySelectorAll('[data-copy]').forEach(element => {element.textContent = text[element.dataset.copy];});
  doc.querySelectorAll('[data-booking-language]').forEach(link => {
    const target = new URL(location.href);
    target.searchParams.set('lang', link.dataset.bookingLanguage);
    target.hash = validToken(invitation) ? 'invite=' + invitation : '';
    link.href = target.href;
    if (link.dataset.bookingLanguage === locale) link.setAttribute('aria-current','true');
  });
  const workspace = byId('foundation-calendar'), status = byId('payment-status'), retry = byId('checkout-retry');
  const switchBTC = byId('switch-to-btc');
  const form = byId('booking-form'), submit = byId('book-and-pay');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  byId('local-timezone').textContent = timeZone.replaceAll('_',' ');
  const today = dateKey(new Date(), timeZone).split('-').map(Number);
  let year = today[0], month = today[1] - 1;
  const firstMonth = year * 12 + month;
  function element(tag, content) {const node = doc.createElement(tag); if (content !== undefined) node.textContent = content; return node;}
  byId('previous-month').setAttribute('aria-label',text.previous);
  byId('next-month').setAttribute('aria-label',text.next);
  for (let day = 0; day < 7; day++) byId('weekday-labels').appendChild(element('span',
    new Intl.DateTimeFormat(language, {weekday:'short', timeZone:'UTC'}).format(new Date(Date.UTC(2026,0,5+day)))));
  async function api(body) {
    const response = await request(prefix+'/booking-api/checkout', {method:'POST', headers:{'Content-Type':'application/json','X-Booking-Invite':invitation},
      body:JSON.stringify({...body, locale}), signal:AbortSignal.timeout(60000)});
    let result;
    try {result = await response.json();} catch {result = {};}
    if (!response.ok) {const error = new Error(result.error || (response.status === 403 ? 'FORBIDDEN' : 'SERVICE_UNAVAILABLE')); throw error;}
    return result;
  }
  function message(error) {byId('booking-help').hidden=false; return text[error?.message] || text.failed;}
  function showSaved(canSwitch = false) {switchBTC.hidden = !canSwitch; workspace.hidden = true; status.textContent = text.saved; retry.textContent = text.resume; retry.hidden = false;}
  function navigate(result) {
    const url = new URL(result.redirect || result.url);
    const allowedCheckout = url.protocol === 'https:' && url.hostname === 'checkout.stripe.com';
    const allowedResult = url.origin === new URL(location.href).origin && url.pathname === prefix+'/payment/result/';
    const expectedBTCOrigin=result.checkoutOrigin||'https://pay.custody.consulting';
    const allowedBTC=url.protocol==='https:'&&url.origin===expectedBTCOrigin&&/^\/i\/[A-Za-z0-9]+$/.test(url.pathname);
    if (url.username || url.password || (!allowedCheckout && !allowedResult&&!allowedBTC)) throw new Error('SERVICE_UNAVAILABLE');
    location.assign(url.href);
  }
  function selectSlot(start) {
    selectedStart = start;
    selectedDay = dateKey(start, timeZone);
    submit.disabled = false;
    byId('selected-appointment').textContent = new Intl.DateTimeFormat(language,{timeZone,dateStyle:'full',timeStyle:'short'}).format(new Date(start)) + ' · ' + timeZone;
  }
  function renderSlots() {
    const container = byId('time-slots'); container.replaceChildren();
    byId('slots-heading').textContent = selectedDay ? new Intl.DateTimeFormat(language,
      {weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(selectedDay + 'T12:00:00Z')) : text.chooseDay;
    for (const start of slots.filter(value => dateKey(value,timeZone) === selectedDay)) {
      const button = element('button',new Intl.DateTimeFormat(language,{timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(start)));
      button.type = 'button'; button.setAttribute('aria-pressed', String(start === selectedStart));
      button.addEventListener('click',() => { selectSlot(start); renderSlots(); });
      container.appendChild(button);
    }
  }
  function renderDays(loading = false) {
    byId('month-heading').textContent = new Intl.DateTimeFormat(language,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)));
    byId('previous-month').disabled = busy || year * 12 + month <= firstMonth;
    byId('next-month').disabled = busy || year * 12 + month >= firstMonth + 11;
    const container = byId('calendar-days'); container.replaceChildren(); container.setAttribute('aria-busy',String(loading));
    const offset = (new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
    for (let empty=0; empty<offset; empty++) container.appendChild(element('span'));
    const available = new Set(slots.map(value => dateKey(value,timeZone)));
    for (let day=1; day<=new Date(Date.UTC(year,month+1,0)).getUTCDate(); day++) {
      const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const button = element('button',String(day)); button.type = 'button';
      button.disabled = loading || !available.has(key);
      button.setAttribute('aria-pressed',String(key === selectedDay));
      button.setAttribute('aria-label',new Intl.DateTimeFormat(language,{dateStyle:'full',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,day))));
      button.addEventListener('click',() => {selectedDay=key; selectedStart=''; submit.disabled=true; byId('selected-appointment').textContent=text.selectFirst; renderDays(); renderSlots();});
      container.appendChild(button);
    }
  }
  async function loadMonth() {
    const version = ++loadVersion;
    selectedStart=''; selectedDay=''; slots=[]; submit.disabled=true;
    byId('selected-appointment').textContent=text.selectFirst;
    byId('calendar-retry').hidden=true; byId('calendar-message').textContent=text.loading;
    workspace.hidden=false; retry.hidden=true; switchBTC.hidden=true; status.textContent=''; renderDays(true); renderSlots();
    try {
      const result = await api({action:'availability', ...monthWindow(year,month), timeZone});
      if (version !== loadVersion) return;
      const updatePrice=()=> {
        const selected=doc.querySelector('input[name="payment-method"]:checked')?.value||'PLN';
        const bitcoinSelected=selected==='BTC';
        const discounted=bitcoinSelected&&!result.lightningPilot;
        byId('booking-fee-label').classList.toggle('is-bitcoin',discounted);
        byId('booking-fee-discount').hidden=!discounted;
        const price=result.prices?.[selected==='BTC'?'PLN':selected];
        byId('booking-original-price').hidden=true;
        byId('booking-price-equivalent').hidden=true;
        const base=result.prices?.PLN?.minorUnits;
        const ratio=base?(result.bitcoinPrice?.minorUnits??base)/base:1;
        const quote=result.btcEstimate;
        byId('payment-btc-label').textContent='BTC';
        if(selected==='BTC') {
          const equivalent=byId('booking-price-equivalent');
          equivalent.hidden=false;
          if(quote) {
            byId('booking-price').textContent='≈ '+new Intl.NumberFormat(locale).format(Math.ceil(quote.satoshis*ratio))+' sats';
            equivalent.textContent='≈ '+new Intl.NumberFormat(locale,{style:'currency',currency:'USD'}).format(Math.round(quote.usdMinorUnits*ratio)/100)+' USD';
          } else {
            byId('booking-price').textContent='BTC';
            equivalent.textContent=locale==='pl'?'Dokładna kwota na fakturze':'Exact amount on invoice';
          }
          if (result.retryStartsAt && result.bitcoinPrice) {
            const {currency, minorUnits} = result.bitcoinPrice;
            equivalent.textContent = new Intl.NumberFormat(locale,{style:'currency',currency}).format(minorUnits/100);
          }
        } else if(price)byId('booking-price').textContent=new Intl.NumberFormat(locale,{style:'currency',currency:price.currency}).format(price.minorUnits/100);
        const discount=byId('bitcoin-discount');
        discount.hidden=result.lightningPilot===true||!result.paymentMethods?.includes('BTC');
        discount.textContent=locale==='pl'?'10% rabatu przy płatności w Bitcoinie. Dokładna kwota sats na fakturze.':'Save 10% when paying with Bitcoin. Exact sats amount is set on the invoice.';

      };
      for(const input of doc.querySelectorAll('input[name="payment-method"]'))input.onchange=updatePrice;
      const btcAvailable=result.paymentMethods?.includes('BTC')===true;
      byId('payment-btc').disabled=!btcAvailable;
      lightningPilot=result.lightningPilot===true;
      if(lightningPilot) {
        byId('payment-btc').checked=true;
        for(const currency of ['pln','eur','gbp']) {
          const input=byId('payment-'+currency);
          input.checked=false;input.disabled=true;
          input.closest('label').hidden=true;
        }
      }
      if (result.retryStartsAt && !initializedRetry && btcAvailable) byId('payment-btc').checked = true;
      if(!btcAvailable&&byId('payment-btc').checked){byId('payment-btc').checked=false;byId('payment-pln').checked=true;}
      updatePrice();
      const note=byId('booking-test-note');
      if(note)note.textContent=result.lightningPilot?(locale==='pl'?'Prywatny pilotaż Lightning · płatność w sieci głównej.':'Private Lightning pilot · mainnet payment.'):btcAvailable?text.testNoteBTC:text.testNote;
      if (result.reference) {reference=result.reference; save(); if(result.redirect) {navigate(result); return;} showSaved(result.canSwitchToBTC === true); return;}
      if (!Array.isArray(result.slots)) throw new Error();
      slots=result.slots.filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value)));
      if (result.retryStartsAt && !initializedRetry) {
        const retryDay = dateKey(result.retryStartsAt, timeZone);
        const [retryYear, retryMonth] = retryDay.split('-').map(Number);
        if (retryDay >= dateKey(new Date(), timeZone) && (retryYear !== year || retryMonth - 1 !== month)) {
          year = retryYear; month = retryMonth - 1;
          return loadMonth();
        }
        initializedRetry = true;
        if (slots.includes(result.retryStartsAt)) selectSlot(result.retryStartsAt);
      }
      renderDays();
      renderSlots();
      const currentPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
      byId('calendar-message').textContent=slots.some(value=>dateKey(value,timeZone).startsWith(currentPrefix)) ? text.ready : text.empty;
    } catch(error) {
      if(version !== loadVersion) return;
      renderDays(); byId('calendar-message').textContent=message(error);
      byId('calendar-retry').hidden=['BOOKING_NEEDS_REVIEW','FORBIDDEN','INVITATION_EXPIRED'].includes(error.message);
      if(error.message==='BOOKING_NEEDS_REVIEW') {workspace.hidden=true; status.textContent=message(error);}
    }
  }
  byId('previous-month').addEventListener('click',()=> {if(busy)return; const date=new Date(Date.UTC(year,month-1,1)); year=date.getUTCFullYear(); month=date.getUTCMonth(); loadMonth();});
  byId('next-month').addEventListener('click',()=> {if(busy)return; const date=new Date(Date.UTC(year,month+1,1)); year=date.getUTCFullYear(); month=date.getUTCMonth(); loadMonth();});
  byId('calendar-retry').addEventListener('click',()=>loadMonth());
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if(busy || !selectedStart || !form.reportValidity())return;
    busy=true; workspace.inert=true; submit.disabled=true; status.textContent=text.creating;
    try {
      const paymentMethod=byId('payment-btc').checked&&!byId('payment-btc').disabled?'BTC':'PLN';
      const result=await api({action:'book',...(lightningPilot?{paymentRail:'lightning'}:{}),currency:doc.querySelector('input[name="payment-method"]:checked')?.value==='BTC'?'PLN':doc.querySelector('input[name="payment-method"]:checked')?.value||'PLN',paymentMethod,start:selectedStart,timeZone,name:byId('booking-name').value,email:byId('booking-email').value,notes:byId('booking-notes').value});
      if(result.reference) {reference=result.reference; save(); showSaved();}
      navigate(result);
    } catch(error) {
      status.textContent=message(error);
      if(['SLOT_UNAVAILABLE','BOOKING_REJECTED','INVALID_INPUT'].includes(error.message)) {
        if(error.message!=='INVALID_INPUT') {await loadMonth(); status.textContent=message(error);}
      } else {
        workspace.hidden=true; retry.hidden=error.message==='BOOKING_NEEDS_REVIEW';
        retry.textContent=reference ? text.resume : text.check;
      }
    } finally {busy=false; workspace.inert=false; submit.disabled=!selectedStart; if(!workspace.hidden)renderDays();}
  });
  retry.addEventListener('click',async()=> {
    if(busy)return;
    if(!reference) {await loadMonth(); return;}
    busy=true; retry.disabled=true; status.textContent=text.opening;
    try {navigate(await api({action:'resume'}));} catch(error) {status.textContent=message(error);}
    finally {busy=false; retry.disabled=false;}
  });
  switchBTC.addEventListener('click',async()=> {
    if(busy || !reference)return;
    busy=true;switchBTC.disabled=true;retry.disabled=true;status.textContent=text.switching;
    try {navigate(await api({action:'switch-payment',paymentMethod:'BTC'}));}
    catch(error) {status.textContent=message(error);}
    finally {busy=false;switchBTC.disabled=false;retry.disabled=false;}
  });
  globalThis.addEventListener?.('pageshow', event => {
    if(event.persisted && validToken(invitation)) {busy=false; workspace.inert=false; loadMonth();}
  });
  if(!validToken(invitation)) {status.textContent=text.invitation; return;}
  loadMonth();
}
