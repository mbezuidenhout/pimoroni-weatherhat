'use strict';

const IoExpander = require('./ioe.js');
const fs = require('node:fs');

const ANE_RADIUS = 7;
const ANE_CIRCUMFERENCE = ANE_RADIUS * 2 * Math.PI;
const ANE_FACTOR = 2.18;
const RAIN_MM_PER_TICK = 0.2794;
const HISTORY_FILE = 'rain.json';

class WindVane {
  constructor({ioe, pin = IoExpander.PIN_WINDVANE}) {
    this.ioe = ioe;
    this.pin = pin;
    this.ready = this.ioe.setMode(this.pin, IoExpander.PIN_MODE_ADC);
  }

  async getWindDir() {
    await this.ready;
    const windDirRaw = await this.ioe.adcInput(this.pin);
    const closest = Object.entries(IoExpander.WIND_DIR_TO_DEGREES).reduce((prev, curr) => {
      return Math.abs(Number(curr[0]) - windDirRaw) < Math.abs(Number(prev[0]) - windDirRaw) ? curr : prev;
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

  constructor({ioe, pin = IoExpander.PIN_ANE1, switchCounterPin = IoExpander.PIN_ANE2, unit = WindSpeed.UNIT[0]}) {
    this.ioe = ioe;
    this.unit = unit;
    this.pin = pin;
    this.switchCounterPin = switchCounterPin;

    this.wind = new Array(60).fill(null);
    this.windIndex = 0;
    this.wind1MinAvg = new Array(5).fill(null);
    this.wind1MinAvgIndex = 0;
    this.wind5MinAvg = new Array(5).fill(null);
    this.wind5MinAvgIndex = 0;
    this.windSpeedCounterTotal = 0;
    this.lastWindSpeedCounter = 0;

    this.ready = this.#init();
  }

  async #init() {
    await this.ioe.setMode(this.pin, IoExpander.PIN_MODE_PP);
    await this.ioe.setupSwitchCounter(this.switchCounterPin);

    setInterval(async () => {
      try {
        const windSpeedCounter = await this.ioe.readSwitchCounter(this.switchCounterPin);
        const previousTotal = this.windSpeedCounterTotal;

        if (windSpeedCounter < this.lastWindSpeedCounter) {
          this.windSpeedCounterTotal += 128 - this.lastWindSpeedCounter;
          this.windSpeedCounterTotal += windSpeedCounter;
        } else {
          this.windSpeedCounterTotal += windSpeedCounter - this.lastWindSpeedCounter;
        }

        this.lastWindSpeedCounter = windSpeedCounter;
        this.wind[this.windIndex] = this.windSpeedCounterTotal - previousTotal;
        this.windIndex = (this.windIndex + 1) % this.wind.length;
      } catch (err) {
        console.error('Error reading wind speed counter:', err);
      }
    }, 1000);

    setTimeout(() => {
      let count = 0;
      setInterval(() => {
        const values = this.wind.filter((value) => value !== null);
        if (values.length > 0) {
          this.wind1MinAvg[this.wind1MinAvgIndex] = values.reduce((sum, value) => sum + value, 0) / values.length;
        }
        count++;
        if (count > 60) {
          count = 0;
          this.wind1MinAvgIndex = (this.wind1MinAvgIndex + 1) % this.wind1MinAvg.length;
        }
      }, 1000);
    }, 1000);

    setTimeout(() => {
      let count = 0;
      setInterval(() => {
        const values = this.wind1MinAvg.filter((value) => value !== null);
        if (values.length > 0) {
          this.wind5MinAvg[this.wind5MinAvgIndex] = values.reduce((sum, value) => sum + value, 0) / values.length;
        }
        count++;
        if (count > 60) {
          count = 0;
          this.wind5MinAvgIndex = (this.wind5MinAvgIndex + 1) % this.wind5MinAvg.length;
        }
      }, 5000);
    }, 5000);
  }

  #counterToSpeed(counter) {
    if (counter === null || counter === undefined) return null;
    const rotationsPerSecond = counter / 2;
    return (rotationsPerSecond * ANE_CIRCUMFERENCE * ANE_FACTOR) / 100;
  }

  getWindSpeed() {
    let index = this.windIndex - 1;
    if (index < 0) index = this.wind.length - 1;
    return this.#counterToSpeed(this.wind[index]) ?? 0;
  }

  getWindSpeed1MinAvg() {
    let index = this.wind1MinAvgIndex;
    if (this.wind1MinAvg[index] === null) {
      index = this.wind1MinAvgIndex - 1;
      if (index < 0) index = this.wind1MinAvg.length - 1;
      if (this.wind1MinAvg[index] === null) return null;
    }
    return this.#counterToSpeed(this.wind1MinAvg[index]);
  }

  getWindSpeed5MinAvg() {
    let index = this.wind5MinAvgIndex;
    if (this.wind5MinAvg[index] === null) {
      index = this.wind5MinAvgIndex - 1;
      if (index < 0) index = this.wind5MinAvg.length - 1;
      if (this.wind5MinAvg[index] === null) return null;
    }
    return this.#counterToSpeed(this.wind5MinAvg[index]);
  }
}

class Rain {
  static UNIT = ['mm', 'inch'];

  constructor({ioe, switchCounterPin = IoExpander.PIN_R4, dataPath, unit = Rain.UNIT[0]}) {
    this.ioe = ioe;
    this.switchCounterPin = switchCounterPin;
    this.unit = unit;
    this.tStart = new Date();

    if (dataPath === undefined) dataPath = process.cwd();
    dataPath = dataPath.endsWith('/') ? dataPath : `${dataPath}/`;
    this.dataPath = dataPath;

    this.rainCounterTotal = 0;
    this.lastRainCounter = 0;
    this.rain = new Array(60).fill(null);
    this.rainIndex = 0;
    this.rainToday = 0;
    this.rainYesterday = 0;
    this.rainByHour = new Array(49).fill(0);
    this.rainByHourIndex = 0;
    this.isDirty = false;

    this.#loadRainfall();
    this.ready = this.#init();

    process.on('exit', () => {
      try {
        this.saveRainfall();
      } catch (err) {
        console.error('Error writing file:', err);
      }
    });

    process.on('SIGINT', () => process.exit());
  }

  #loadRainfall() {
    fs.readFile(this.dataPath + HISTORY_FILE, {encoding: 'utf8'}, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          console.error(`${this.dataPath}${HISTORY_FILE} not found. No rainfall history.`);
        } else {
          console.error(`An error occurred trying to open ${this.dataPath}${HISTORY_FILE}. No rainfall history.`, err);
        }
        return;
      }

      try {
        const jsonData = JSON.parse(data);
        this.rainCounterTotal += jsonData.rainTotal ?? 0;
        this.rainToday = jsonData.rainToday ?? this.rainToday;
        this.rainYesterday = jsonData.rainYesterday ?? jsonData.rainYesterDay ?? this.rainYesterday;
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
      }
    });
  }

  async #init() {
    await this.ioe.setMode(IoExpander.PIN_R2, IoExpander.PIN_MODE_PU);
    await this.ioe.setMode(IoExpander.PIN_R3, IoExpander.PIN_MODE_PP);
    await this.ioe.setupSwitchCounter(this.switchCounterPin);
    await this.ioe.setMode(IoExpander.PIN_R5, IoExpander.PIN_MODE_PU);
    await this.ioe.output(IoExpander.PIN_R3, 0);
    await this.ioe.setPinInterrupt(this.switchCounterPin);

    setInterval(async () => {
      try {
        const rainCounter = await this.ioe.readSwitchCounter(this.switchCounterPin);
        const previousTotal = this.rainCounterTotal;

        if (rainCounter < this.lastRainCounter) {
          this.rainCounterTotal += 128 - this.lastRainCounter;
          this.rainCounterTotal += rainCounter;
        } else {
          this.rainCounterTotal += rainCounter - this.lastRainCounter;
        }

        if (rainCounter !== this.lastRainCounter) {
          this.isDirty = true;
          this.lastRainCounter = rainCounter;
        }

        const rainPerSecond = this.rainCounterTotal - previousTotal;
        this.rain[this.rainIndex] = rainPerSecond;
        this.rainToday += rainPerSecond;
        this.rainByHour[this.rainByHourIndex] += rainPerSecond;
        this.rainIndex = (this.rainIndex + 1) % this.rain.length;

        const now = new Date();
        if (this.tStart.getDay() !== now.getDay()) {
          this.tStart = now;
          this.rainYesterday = this.rainToday;
          this.rainToday = 0;
        }
      } catch (err) {
        console.error('Error reading rainfall counter:', err);
      }
    }, 1000);

    setInterval(() => {
      if (this.isDirty) {
        this.saveRainfall();
        this.isDirty = false;
      }
    }, 60000);

    setInterval(() => {
      this.rainByHourIndex = (this.rainByHourIndex + 1) % this.rainByHour.length;
      this.rainByHour[this.rainByHourIndex] = 0;
    }, 1800000);
  }

  saveRainfall() {
    try {
      const data = JSON.stringify({
        rainTotal: this.rainCounterTotal,
        rainToday: this.rainToday,
        rainYesterday: this.rainYesterday
      });
      fs.writeFileSync(this.dataPath + HISTORY_FILE, data, {encoding: 'utf8'});
    } catch (err) {
      console.error('Error writing file:', err);
    }
  }

  getRainfall() {
    return this.rain.reduce((sum, value) => sum + (value ?? 0), 0) * RAIN_MM_PER_TICK;
  }

  getRainfallTotal() {
    return this.rainCounterTotal * RAIN_MM_PER_TICK;
  }

  getRainfall24Hours() {
    let rainfall = this.rainByHour.reduce((sum, value) => sum + (value ?? 0), 0);
    let prevIndex = this.rainByHourIndex - 1;
    if (prevIndex < 0) prevIndex = this.rainByHour.length - 1;
    rainfall -= this.rainByHour[prevIndex] ?? 0;
    return rainfall * RAIN_MM_PER_TICK;
  }

  getRainfallYesterday() {
    return this.rainYesterday * RAIN_MM_PER_TICK;
  }

  getRainfallToday() {
    return this.rainToday * RAIN_MM_PER_TICK;
  }
}

module.exports = {WindSpeed, WindVane, Rain};
