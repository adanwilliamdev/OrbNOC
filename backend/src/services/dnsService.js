const dns = require('dns');
const util = require('util');

const resolve = util.promisify(dns.resolve);
const lookup = util.promisify(dns.lookup);

async function resolveDomain(domain, recordType = 'A') {
  if (recordType === 'A' || recordType === 'AAAA') {
    const addresses = await resolve(domain, recordType);
    return addresses.map((addr) => ({ value: addr }));
  }
  if (recordType === 'MX') {
    const mxRecords = await resolve(domain, 'MX');
    return mxRecords.map((mx) => ({ value: `${mx.exchange} (priority ${mx.priority})` }));
  }
  if (recordType === 'TXT') {
    const txtRecords = await resolve(domain, 'TXT');
    return txtRecords.map((txt) => ({ value: txt.join(' ') }));
  }
  if (recordType === 'CNAME') {
    const cnameRecords = await resolve(domain, 'CNAME');
    return cnameRecords.map((cname) => ({ value: cname }));
  }
  const addresses = await resolve(domain, recordType);
  return addresses.map((addr) => ({ value: addr }));
}

module.exports = { resolve, lookup, resolveDomain };
