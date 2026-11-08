export function bookingConfig(env={}) {
  const environment=env.BOOKING_ENV||'staging';
  if(!['staging','production'].includes(environment))throw new Error('Invalid BOOKING_ENV');
  const live=environment==='production';
  const pilot=env.BOOKING_LIGHTNING_PILOT==='true';
  const pathPrefix=pilot?'/lightning-pilot':'';
  const pilotMinorUnits=pilot?Number(env.BOOKING_PILOT_MINOR_UNITS):null;
  if(pilot&&(live||!/^\/var\/lib\/custody-booking-lightning-pilot\/[^/]+\.sqlite$/.test(env.BOOKING_DB||'')||
    !Number.isSafeInteger(pilotMinorUnits)||pilotMinorUnits<1||pilotMinorUnits>1000||
    env.BTCPAY_STORE_ID!=='2uAiv8QD6LxdFrLvJjgyHdVUyN96X4uqWCz75H7vy2M2'||env.BTCPAY_NETWORK!=='mainnet'||
    env.BTCPAY_LIGHTNING_ENABLED!=='true'||env.BTCPAY_ENABLED!=='true'||!env.CAL_EVENT_ID||
    [7783830,7772427].includes(Number(env.CAL_EVENT_ID))||env.CAL_STAGING_EVENT_ID))throw new Error('Invalid isolated Lightning pilot configuration');
  const origin=live?'https://custody.consulting':'https://staging.custody.consulting';
  if(env.BOOKING_PUBLIC_ORIGIN&&env.BOOKING_PUBLIC_ORIGIN!==origin)throw new Error('Booking origin does not match environment');
  const port=Number(env.BOOKING_PORT||(pilot?8014:live?8013:8012));
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid BOOKING_PORT');
  if(pilot&&port!==8014)throw new Error('Lightning pilot must use its isolated port');
  if(live) {
    if(!['true','false',undefined].includes(env.BTCPAY_ENABLED))throw new Error('Invalid BTCPAY_ENABLED');
    if(env.BOOKING_PRODUCTION_ENABLED!=='true')throw new Error('Production booking activation is required');
    if(!env.BOOKING_DB?.startsWith('/var/lib/custody-booking-production/'))throw new Error('Production requires its own database');
    if(!/^rk_live_/.test(env.STRIPE_RESTRICTED_KEY||''))throw new Error('Production requires a restricted live Stripe key');
    if(!env.CAL_EVENT_ID||env.CAL_STAGING_EVENT_ID)throw new Error('Production requires CAL_EVENT_ID, without staging event configuration');
    if(env.BTCPAY_ENABLED==='true'&&(env.BTCPAY_NETWORK!=='mainnet'||/demo\.btcpayserver\.org/.test(env.BTCPAY_URL||'')))throw new Error('Production BTC requires a mainnet store');
  }else if(env.STRIPE_RESTRICTED_KEY&&!/^rk_test_/.test(env.STRIPE_RESTRICTED_KEY))throw new Error('Staging requires a restricted test key');
  return Object.freeze({environment,live,origin,port,pilot,pathPrefix,pilotMinorUnits,integration:pilot?'custody-lightning-booking-pilot':live?'custody-foundation-production':'custody-foundation-staging'});
}
