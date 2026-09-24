'use strict';

const IoExpander = require('./ioe.js');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ANE_RADIUS = 7;
const ANE_CIRCUMFERENCE = ANE_RADIUS * 2 * Math.PI;
const ANE_FACTOR = 2.18;
const RAIN_MM_PER_TICK = 0.2794;

const HISTORY_FILE = 'rain.json';
const APP_NAME = 'pimoroni-weatherhat';

/**
 * Return the standard per-user application data directory for the
 * current operating system.
 *
 * Linux:
 *   $XDG_DATA_HOME/pimoroni-weatherhat
 *   or ~/.local/share/pimoroni-weatherhat
 *
 * macOS:
 *   ~/Library/Application Support/pimoroni-weatherhat
 *
 * Windows:
 *   %APPDATA%\pimoroni-weatherhat
 */
function getDefaultDataPath() {
  const home = os.homedir();

  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        APP_NAME
      );

    case 'darwin':
      return path.join(
        home,
        'Library',
        'Application Support',
        APP_NAME
      );

    default:
      return path.join(
        process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'),
        APP_NAME
      );
  }
}

class WindVane {
  constructor({ioe, pin = IoExpander.PIN_WINDVANE}) {
    this.ioe = ioe;
    this.pin = pin;

    this.ready = this.ioe.setMode(
      this.pin,
      IoExpander.PIN_MODE_ADC
    );
  }

  async getWindDir() {
    await this.ready;

    const windDirRaw = await this.ioe.adcInput(this.pin);

    const closest = Object.entries(
      IoExpander.WIND_DIR_TO_DEGREES
    ).reduce((prev, curr) => {
      return Math.abs(Number(curr[0]) - windDirRaw) <
        Math.abs(Number(prev[0]) - windDirRaw)
        ? curr
        : prev;
    });

    return closest[1];
  }

  async getWindDirShortCardinal() {
    const degrees = await this.getWindDir();

    return IoExpander.WIND_DIR_TO_SHORT_CARDINAL[degrees];
  }
}

class WindSpeed {
    static UNIT = ['m/s', 'km/h', 'kn', 'mph', 'ft/s'];

    static SAMPLE_INTERVAL_MS = 1000;
    static COUNTER_MAX = 128;

    constructor({
        ioe,
        pin = IoExpander.PIN_ANE1,
        switchCounterPin = IoExpander.PIN_ANE2,
        unit = WindSpeed.UNIT[0]
    }) {
        this.ioe = ioe;
        this.pin = pin;
        this.switchCounterPin = switchCounterPin;
        this.unit = unit;

        if (!WindSpeed.UNIT.includes(unit)) {
            throw new RangeError(
                `Invalid wind speed unit "${unit}". ` +
                `Expected one of: ${WindSpeed.UNIT.join(', ')}`
            );
        }

        /*
         * Keep slightly more than five minutes of samples.
         *
         * Each sample:
         *
         * {
         *     timestamp: <milliseconds>,
         *     speed: <m/s>
         * }
         */
        this.samples = [];

        this.currentSpeed = 0;

        this.lastCounter = null;
        this.lastSampleTime = null;

        this._sampling = false;
        this._timer = null;

        this.ready = this.#init();
    }

    async #init() {
        /*
         * This pin supplies the other side of the anemometer switch.
         */
        await this.ioe.setMode(
            this.pin,
            IoExpander.PIN_MODE_PP
        );

        await this.ioe.output(this.pin, 0);

        /*
         * Configure the IO Expander switch counter.
         */
        await this.ioe.setupSwitchCounter(
            this.switchCounterPin
        );

        /*
         * Establish a baseline counter value.
         *
         * This prevents counts that occurred before the first sample from
         * being interpreted as having occurred during a one-second period.
         */
        this.lastCounter = await this.ioe.readSwitchCounter(
            this.switchCounterPin
        );

        this.lastSampleTime = process.hrtime.bigint();

        this._timer = setInterval(
            () => this.#sample(),
            WindSpeed.SAMPLE_INTERVAL_MS
        );

        /*
         * Do not keep Node.js alive solely because the wind-speed sampler
         * exists.
         */
        this._timer.unref?.();
    }

    async #sample() {
        /*
         * setInterval() can invoke another callback before an asynchronous
         * I2C transaction has completed. Prevent overlapping samples.
         */
        if (this._sampling) {
            return;
        }

        this._sampling = true;

        try {
            const counter = await this.ioe.readSwitchCounter(
                this.switchCounterPin
            );

            const now = process.hrtime.bigint();

            const elapsedSeconds =
                Number(now - this.lastSampleTime) / 1_000_000_000;

            if (elapsedSeconds <= 0) {
                return;
            }

            const pulses = this.#counterDelta(
                this.lastCounter,
                counter
            );

            this.lastCounter = counter;
            this.lastSampleTime = now;

            /*
             * The Weather HAT anemometer generates two switch pulses
             * per complete revolution.
             */
            const rotations = pulses / 2;

            const rotationsPerSecond =
                rotations / elapsedSeconds;

            /*
             * ANE_CIRCUMFERENCE is in centimetres.
             *
             * Pimoroni's calibration factor (2.18) converts the cup
             * velocity to estimated wind velocity.
             *
             * Divide by 100 to convert cm/s to m/s.
             */
            const speed =
                (
                    rotationsPerSecond *
                    ANE_CIRCUMFERENCE *
                    ANE_FACTOR
                ) / 100;

            this.currentSpeed = speed;

            const timestamp = Date.now();

            this.samples.push({
                timestamp,
                speed
            });

            /*
             * Keep only a little more than five minutes.
             */
            const cutoff = timestamp - 310000;

            while (
                this.samples.length > 0 &&
                this.samples[0].timestamp < cutoff
            ) {
                this.samples.shift();
            }

        } catch (err) {
            console.error(
                'Error reading wind speed counter:',
                err
            );
        } finally {
            this._sampling = false;
        }
    }

    #counterDelta(previous, current) {
        if (previous === null) {
            return 0;
        }

        /*
         * The Nuvoton switch counter is 7-bit:
         *
         * 126 -> 127 -> 0 -> 1
         */
        if (current >= previous) {
            return current - previous;
        }

        return (
            WindSpeed.COUNTER_MAX -
            previous +
            current
        );
    }

    #average(seconds) {
        if (this.samples.length === 0) {
            return null;
        }

        const cutoff =
            Date.now() - (seconds * 1000);

        const values = this.samples.filter(
            sample => sample.timestamp >= cutoff
        );

        if (values.length === 0) {
            return null;
        }

        return (
            values.reduce(
                (sum, sample) => sum + sample.speed,
                0
            ) / values.length
        );
    }

    #convert(speed) {
        if (speed === null) {
            return null;
        }

        switch (this.unit) {
            case 'm/s':
                return speed;

            case 'km/h':
                return speed * 3.6;

            case 'kn':
                return speed * 1.9438444924406;

            case 'mph':
                return speed * 2.2369362920544;

            case 'ft/s':
                return speed * 3.2808398950131;

            default:
                return speed;
        }
    }

    getWindSpeed() {
        return this.#convert(
            this.currentSpeed
        );
    }

    getWindSpeed1MinAvg() {
        return this.#convert(
            this.#average(60)
        );
    }

    getWindSpeed5MinAvg() {
        return this.#convert(
            this.#average(300)
        );
    }

    stop() {
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }
}

class Rain {
  static UNIT = ['mm', 'in'];

  static COUNTER_MAX = 128;

  constructor({
    ioe,
    switchCounterPin = IoExpander.PIN_R4,
    dataPath,
    unit = Rain.UNIT[0]
  }) {
    this.ioe = ioe;
    this.switchCounterPin = switchCounterPin;
    this.unit = unit;

    if (!Rain.UNIT.includes(unit)) {
      throw new RangeError(
        `Invalid rainfall unit "${unit}". ` +
        `Expected one of: ${Rain.UNIT.join(', ')}`
      );
    }

    this.tStart = new Date();

    /*
     * If dataPath has not explicitly been supplied, use the
     * standard per-user application data directory for the
     * operating system.
     */
    this.dataPath =
      dataPath ?? getDefaultDataPath();

    /*
     * Construct paths using Node's path module rather than
     * assuming '/' is the directory separator.
     */
    this.historyFile = path.join(
      this.dataPath,
      HISTORY_FILE
    );

    /*
     * The application-specific directory may not exist yet
     * on first use. Create it and any missing parent
     * directories.
     */
    fs.mkdirSync(this.dataPath, {
      recursive: true
    });

    /*
     * All rainfall values are stored internally as raw
     * tipping-bucket counts. Unit conversion is performed
     * only when a rainfall value is requested.
     */
    this.rainCounterTotal = 0;
    this.lastRainCounter = 0;

    this.rain = new Array(60).fill(null);
    this.rainIndex = 0;

    this.rainToday = 0;
    this.rainYesterday = 0;

    this.rainByHour =
      new Array(49).fill(0);

    this.rainByHourIndex = 0;

    this.isDirty = false;

    this.#loadRainfall();

    this.ready = this.#init();

    process.on('exit', () => {
      try {
        this.saveRainfall();
      } catch (err) {
        console.error(
          'Error writing file:',
          err
        );
      }
    });

    process.on(
      'SIGINT',
      () => process.exit()
    );
  }

  #loadRainfall() {
    fs.readFile(
      this.historyFile,
      {encoding: 'utf8'},
      (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            console.error(
              `${this.historyFile} not found. No rainfall history.`
            );
          } else {
            console.error(
              `An error occurred trying to open ${this.historyFile}. No rainfall history.`,
              err
            );
          }

          return;
        }

        try {
          const jsonData =
            JSON.parse(data);

          this.rainCounterTotal +=
            jsonData.rainTotal ?? 0;

          this.rainToday =
            jsonData.rainToday ??
            this.rainToday;

          this.rainYesterday =
            jsonData.rainYesterday ??
            jsonData.rainYesterDay ??
            this.rainYesterday;
        } catch (parseError) {
          console.error(
            `Error parsing ${this.historyFile}:`,
            parseError
          );
        }
      }
    );
  }

  async #init() {
    await this.ioe.setMode(
      IoExpander.PIN_R2,
      IoExpander.PIN_MODE_PU
    );

    await this.ioe.setMode(
      IoExpander.PIN_R3,
      IoExpander.PIN_MODE_PP
    );

    await this.ioe.setupSwitchCounter(
      this.switchCounterPin
    );

    await this.ioe.setMode(
      IoExpander.PIN_R5,
      IoExpander.PIN_MODE_PU
    );

    await this.ioe.output(
      IoExpander.PIN_R3,
      0
    );

    await this.ioe.setPinInterrupt(
      this.switchCounterPin
    );

    setInterval(async () => {
      try {
        const rainCounter =
          await this.ioe.readSwitchCounter(
            this.switchCounterPin
          );

        const previousTotal =
          this.rainCounterTotal;

        if (rainCounter < this.lastRainCounter) {
          this.rainCounterTotal +=
            Rain.COUNTER_MAX -
            this.lastRainCounter;

          this.rainCounterTotal +=
            rainCounter;
        } else {
          this.rainCounterTotal +=
            rainCounter -
            this.lastRainCounter;
        }

        if (
          rainCounter !==
          this.lastRainCounter
        ) {
          this.isDirty = true;
          this.lastRainCounter =
            rainCounter;
        }

        const rainPerSecond =
          this.rainCounterTotal -
          previousTotal;

        this.rain[this.rainIndex] =
          rainPerSecond;

        this.rainToday +=
          rainPerSecond;

        this.rainByHour[
          this.rainByHourIndex
        ] += rainPerSecond;

        this.rainIndex =
          (this.rainIndex + 1) %
          this.rain.length;

        const now = new Date();

        /*
         * Detect a change of calendar date rather than a
         * change in day-of-week.
         */
        if (
          this.tStart.getFullYear() !==
            now.getFullYear() ||
          this.tStart.getMonth() !==
            now.getMonth() ||
          this.tStart.getDate() !==
            now.getDate()
        ) {
          this.tStart = now;

          this.rainYesterday =
            this.rainToday;

          this.rainToday = 0;
        }
      } catch (err) {
        console.error(
          'Error reading rainfall counter:',
          err
        );
      }
    }, 1000);

    setInterval(() => {
      if (this.isDirty) {
        this.saveRainfall();
        this.isDirty = false;
      }
    }, 60000);

    setInterval(() => {
      this.rainByHourIndex =
        (this.rainByHourIndex + 1) %
        this.rainByHour.length;

      this.rainByHour[
        this.rainByHourIndex
      ] = 0;
    }, 1800000);
  }

  /*
   * Convert a raw tipping-bucket count to the configured
   * rainfall unit.
   *
   * The Weather HAT rain gauge records 0.2794 mm for each
   * bucket tip.
   */
  #convert(ticks) {
    const rainfall =
      ticks * RAIN_MM_PER_TICK;

    switch (this.unit) {
      case 'mm':
        return rainfall;

      case 'in':
        return rainfall / 25.4;

      default:
        return rainfall;
    }
  }

  saveRainfall() {
    try {
      /*
       * Store raw tipping-bucket counts rather than converted
       * rainfall values. This keeps the history file independent
       * of the selected display unit.
       */
      const data = JSON.stringify({
        rainTotal:
          this.rainCounterTotal,

        rainToday:
          this.rainToday,

        rainYesterday:
          this.rainYesterday
      });

      fs.writeFileSync(
        this.historyFile,
        data,
        {encoding: 'utf8'}
      );
    } catch (err) {
      console.error(
        'Error writing file:',
        err
      );
    }
  }

  getRainfall() {
    const rainfall =
      this.rain.reduce(
        (sum, value) =>
          sum + (value ?? 0),
        0
      );

    return this.#convert(rainfall);
  }

  getRainfallTotal() {
    return this.#convert(
      this.rainCounterTotal
    );
  }

  getRainfall24Hours() {
    let rainfall =
      this.rainByHour.reduce(
        (sum, value) =>
          sum + (value ?? 0),
        0
      );

    let prevIndex =
      this.rainByHourIndex - 1;

    if (prevIndex < 0) {
      prevIndex =
        this.rainByHour.length - 1;
    }

    rainfall -=
      this.rainByHour[
        prevIndex
      ] ?? 0;

    return this.#convert(rainfall);
  }

  getRainfallYesterday() {
    return this.#convert(
      this.rainYesterday
    );
  }

  getRainfallToday() {
    return this.#convert(
      this.rainToday
    );
  }
}

module.exports = {
  WindSpeed,
  WindVane,
  Rain
};
