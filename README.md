# pimoroni-weatherhat

Node.js library for the Pimoroni Weather HAT based on the Nuvoton MS51 IO Expander.

This version uses the [`i2c`](https://www.npmjs.com/package/i2c) package instead of `i2c-bus`. The `i2c` package requires Node.js 18 or newer and uses Node-API for ABI stability across Node.js releases, including Node.js 24.

## Install

```bash
npm install @bezuidenhout/pimoroni-weatherhat
```

I2C must be enabled on the host and the user running Node.js must have access to `/dev/i2c-*`.

## Usage

```javascript
const IoExpander = require('./ioe.js');
const {WindVane, WindSpeed, Rain} = require('./weather.js');

async function main() {
  const ioe = new IoExpander({i2c_addr: 0x12, smbus_id: 1});
  await ioe.ready;
  await ioe.reset();

  const windVane = new WindVane({ioe});
  const windSpeed = new WindSpeed({ioe});
  const rainfall = new Rain({ioe});

  await Promise.all([windVane.ready, windSpeed.ready, rainfall.ready]);

  console.log(await windVane.getWindDirShortCardinal());
  console.log(windSpeed.getWindSpeed());
  console.log(rainfall.getRainfallToday());
}

main().catch(console.error);
```

## Migration from 0.1.x

The old driver used synchronous methods from `i2c-bus`. The replacement `i2c` package is asynchronous, therefore hardware-reading operations on `IoExpander` now return Promises.

In particular, these Weather HAT calls are now asynchronous:

```javascript
await windVane.getWindDir();
await windVane.getWindDirShortCardinal();
```

Wind speed and rainfall getters remain synchronous because those classes sample their hardware counters in the background and expose cached values.

Use `await ioe.ready` after constructing `IoExpander`, and use the `ready` Promise exposed by `WindVane`, `WindSpeed`, and `Rain` when you need to know that their hardware setup has completed.
