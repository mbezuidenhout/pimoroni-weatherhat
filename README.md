# pimoroni-weatherhat

Node.js library for the Pimoroni Weather HAT based on the Nuvoton MS51 IO Expander.

This version uses the [`i2c`](https://www.npmjs.com/package/i2c) package instead of `i2c-bus`. The `i2c` package requires Node.js 18 or newer and uses Node-API for ABI stability across Node.js releases, including Node.js 24.

The library supports configurable units for both wind speed and rainfall. Rainfall can be returned in millimetres (`mm`) or inches (`in`).

Rainfall data is persisted in a platform-appropriate user data directory instead of storing `rain.json` alongside the application source. This allows the library to work correctly when installed as an npm package or when the application directory is read-only.

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
  const ioe = new IoExpander({
    i2c_addr: 0x12,
    smbus_id: 1
  });

  await ioe.ready;
  await ioe.reset();

  const windVane = new WindVane({ioe});
  const windSpeed = new WindSpeed({ioe});
  const rainfall = new Rain({ioe});

  await Promise.all([
    windVane.ready,
    windSpeed.ready,
    rainfall.ready
  ]);

  console.log(await windVane.getWindDirShortCardinal());
  console.log(windSpeed.getWindSpeed());
  console.log(rainfall.getRainfallToday());
}

main().catch(console.error);
```

## Wind Speed Units

The `WindSpeed` class supports several output units.

Supported values are:

```text
m/s
km/h
kn
mph
ft/s
```

The default is metres per second (`m/s`).

For example, to return wind speed in kilometres per hour:

```javascript
const windSpeed = new WindSpeed({
  ioe,
  unit: 'km/h'
});
```

The selected unit applies to all wind-speed getters:

```javascript
windSpeed.getWindSpeed();
windSpeed.getWindSpeed1MinAvg();
windSpeed.getWindSpeed5MinAvg();
```

## Rainfall Units

The `Rain` class supports rainfall measurements in millimetres or inches.

Supported values are:

```text
mm
in
```

The default is millimetres (`mm`), preserving the behaviour of previous versions.

To use millimetres:

```javascript
const rainfall = new Rain({
  ioe,
  unit: 'mm'
});
```

To return rainfall in inches:

```javascript
const rainfall = new Rain({
  ioe,
  unit: 'in'
});
```

The selected unit applies to all rainfall getters:

```javascript
rainfall.getRainfall();
rainfall.getRainfallTotal();
rainfall.getRainfall24Hours();
rainfall.getRainfallYesterday();
rainfall.getRainfallToday();
```

For example:

```javascript
const rainfall = new Rain({
  ioe,
  unit: 'in'
});

await rainfall.ready;

console.log(rainfall.getRainfallToday());
console.log(rainfall.getRainfall24Hours());
```

Internally, rainfall is stored as raw tipping-bucket counts. Unit conversion is performed only when a rainfall value is requested.

Each rain gauge bucket tip represents:

```text
0.2794 mm
```

When inches are selected, the millimetre measurement is converted using:

```text
1 inch = 25.4 mm
```

Because rainfall history is stored as raw counts rather than converted measurements, the configured unit can be changed without modifying or migrating the existing rainfall history.

## Rainfall Data Storage

The `Rain` class persists rainfall information to a `rain.json` file so that accumulated rainfall data can survive application restarts.

The file is stored in a standard per-user application data location rather than inside the installed module directory.

This is important when the package is installed globally, installed under `node_modules`, used by a service, or run from a read-only application directory.

The exact location depends on the operating system and environment.

Typical locations include:

```text
Linux:
~/.local/share/pimoroni-weatherhat/rain.json

Linux with XDG_DATA_HOME:
$XDG_DATA_HOME/pimoroni-weatherhat/rain.json

macOS:
~/Library/Application Support/pimoroni-weatherhat/rain.json

Windows:
%APPDATA%\pimoroni-weatherhat\rain.json
```

The required directory is created automatically if it does not already exist.

Applications using the library therefore do not need to create or manage `rain.json` themselves.

### Custom rainfall data location

A custom storage directory can be supplied using the `dataPath` option:

```javascript
const rainfall = new Rain({
  ioe,
  dataPath: '/path/to/application/data'
});
```

The rainfall history will then be stored as:

```text
/path/to/application/data/rain.json
```

The directory is created automatically if necessary.

The `dataPath` and `unit` options can be used together:

```javascript
const rainfall = new Rain({
  ioe,
  dataPath: '/path/to/application/data',
  unit: 'in'
});
```

## Migration from 0.1.x

### I2C

The old driver used synchronous methods from `i2c-bus`. The replacement `i2c` package is asynchronous, therefore hardware-reading operations on `IoExpander` now return Promises.

In particular, these Weather HAT calls are now asynchronous:

```javascript
await windVane.getWindDir();
await windVane.getWindDirShortCardinal();
```

Wind speed and rainfall getters remain synchronous because those classes sample their hardware counters in the background and expose cached values.

Use:

```javascript
await ioe.ready;
```

after constructing `IoExpander`.

The `WindVane`, `WindSpeed`, and `Rain` classes also expose a `ready` Promise that can be used to wait until their hardware setup has completed:

```javascript
await Promise.all([
  windVane.ready,
  windSpeed.ready,
  rainfall.ready
]);
```

### Rainfall units

Rainfall continues to use millimetres by default, so existing applications do not need to specify a unit:

```javascript
const rainfall = new Rain({ioe});
```

is equivalent to:

```javascript
const rainfall = new Rain({
  ioe,
  unit: 'mm'
});
```

Applications that require rainfall in inches can now use:

```javascript
const rainfall = new Rain({
  ioe,
  unit: 'in'
});
```

The rainfall persistence format remains independent of the selected unit, so existing `rain.json` files do not need to be converted when changing between millimetres and inches.

### Rainfall persistence

Previous versions could store `rain.json` relative to the application or module source.

The rainfall persistence file is now stored in the user's application data directory.

If you need to preserve existing rainfall history when upgrading, move the existing `rain.json` file to the new data directory before starting the updated application.

Once running, the library will read and update rainfall data from the new location.
