'use strict';

const IoExpander = require('./ioe.js');
const fs = require('node:fs');

//const ioe = new IoExpander({i2c_addr: 0x12});

const ANE_RADIUS = 7;     // Radius from center to the center of a cup, in CM
const ANE_CIRCUMFERENCE = ANE_RADIUS * 2 * Math.PI;
const ANE_FACTOR = 2.18;  // Anemometer factor

const RAIN_MM_PER_TICK = 0.2794;

const HISTORY_FILE = 'data.json';

class WindVane {
  constructor({ioe, pin = IoExpander.PIN_WINDVANE}) {
    this.ioe = ioe;
    ioe.setMode(pin, IoExpander.PIN_MODE_ADC);
  };

  getWindDir() {
    let windDirRaw = this.ioe.adcInput(IoExpander.PIN_WINDVANE);
    let closest = Object.entries(IoExpander.WIND_DIR_TO_DEGREES).reduce((prev, curr) => {
      return Math.abs(curr[0] - windDirRaw) < Math.abs(prev[0] - windDirRaw) ? curr : prev;
    });
    return closest[1];
  }

  getWindDirShortCardinal() {
    let windDirRaw = this.ioe.adcInput(IoExpander.PIN_WINDVANE);
    let closest = Object.entries(IoExpander.WIND_DIR_TO_DEGREES).reduce((prev, curr) => {
      return Math.abs(curr[0] - windDirRaw) < Math.abs(prev[0] - windDirRaw) ? curr : prev;
    });
    return IoExpander.WIND_DIR_TO_SHORT_CARDINAL[closest[1]];
  }
}

class WindSpeed {
  constructor({ioe, pin = IoExpander.PIN_ANE1, switchCounterPin = IoExpander.PIN_ANE2}) {
    this.ioe = ioe;
    ioe.setMode(pin, IoExpander.PIN_MODE_PP);
    ioe.setupSwitchCounter(switchCounterPin);
    
    this.wind = new Array(60).fill(null); // Keep track of wind counter every second for one minute
    this.windIndex = 0; // Index of next windSpeedArray entry

    this.wind1MinAvg = new Array(5).fill(null);
    this.wind1MinAvgIndex = 0;

    this.wind5MinAvg = new Array(5).fill(null);
    this.wind5MinAvgIndex = 0;

    this.windSpeedCounterTotal = 0;
    this.lastWindSpeedCounter = 0;
    setInterval(() => {
      let windSpeedCounter = this.ioe.readSwitchCounter(IoExpander.PIN_ANE2);

      let windSpeedPerSecond = this.windSpeedCounterTotal;
      if (windSpeedCounter < this.lastWindSpeedCounter) {
        this.windSpeedCounterTotal += 128 - this.lastWindSpeedCounter;
        this.windSpeedCounterTotal += windSpeedCounter;
      } else {
        this.windSpeedCounterTotal += windSpeedCounter - this.lastWindSpeedCounter;
      }
      this.lastWindSpeedCounter = windSpeedCounter;
      windSpeedPerSecond = this.windSpeedCounterTotal - windSpeedPerSecond;
      this.wind[this.windIndex] = windSpeedPerSecond;

      this.windIndex++;
      if(this.windIndex >= this.wind.length) {
        this.windIndex = 0;
      }
    }, 1000);

    setTimeout(() => {
      let count = 0;
      setInterval(() => {
        const nullCount = this.wind.filter(value => value === null).length;
        this.wind1MinAvg[this.wind1MinAvgIndex] = this.wind.reduce((previousValue, currentValue) => previousValue + currentValue, 0) / (this.wind.length - nullCount);
        count++;
        if(count > 60) { // 60 seconds has passed
          count = 0;
          this.wind1MinAvgIndex++;
          if(this.wind1MinAvgIndex >= this.wind1MinAvg.length) {
            this.wind1MinAvgIndex = 0;
          }
        }
      }, 1000);
    }, 1000);

    setTimeout(() => {
      let count = 0;
      setInterval(() => {
        const nullCount = this.wind1MinAvg.filter(value => value === null).length;
        this.wind5MinAvg[this.wind5MinAvgIndex] = this.wind1MinAvg.reduce((previousValue, currentValue) => previousValue + currentValue, 0) / (this.wind1MinAvg.length - nullCount);
        count++;
        if(count > 300) { // 5 minutes has passed
          count = 0;
          this.wind5MinAvgIndex++;
          if(this.wind5MinAvgIndex >= this.wind5MinAvg.length) {
            this.wind5MinAvgIndex = 0;
          }
        }
      }, 5000);
    }, 5000);
  }

  // Return wind speed in m/s
  getWindSpeed() {
    let index = this.windIndex - 1;
    if(index < 0) {
      index = this.wind.length - 1;
    }
    let speed = this.wind[index] / 2; // Two pulses per rotation
    speed = (speed * ANE_CIRCUMFERENCE * ANE_FACTOR) / 100;
    return speed;
  }

  getWindSpeed1MinAvg() {
    let index = this.wind1MinAvgIndex;
    if(this.wind1MinAvg[index] === null) {
      // If the value at this index position is null try one back
      index = this.wind1MinAvgIndex - 1;
      if(index < 0) {
        index = this.wind1MinAvg.length - 1;
      }
      if(this.wind1MinAvg[index] === null) {
        return null;
      }
    }
    let speed = this.wind1MinAvg[index] / 2; // Two pulses per rotation
    speed = (speed * ANE_CIRCUMFERENCE * ANE_FACTOR) / 100;
    return speed;
  }

  getWindSpeed5MinAvg() {
    let index = this.wind5MinAvgIndex;
    if(this.wind5MinAvg[index] === null) {
      // If the value at this index position is null try one back
      index = this.wind5MinAvgIndex - 1;
      if(index < 0) {
        index = this.wind5MinAvg.length - 1;
      }
      if(this.wind5MinAvg[index] === null) {
        return null;
      }
    }
    let speed = this.wind5MinAvg[index] / 2; // Two pulses per rotation
    speed = (speed * ANE_CIRCUMFERENCE * ANE_FACTOR) / 100;
    return speed;
  }
}

class Rain {
  constructor({ioe, switchCounterPin = IoExpander.PIN_R4}) {
    this.ioe = ioe;
    this.tStart = new Date();

    fs.readFile(HISTORY_FILE, 'utf8', (err, data) => {
      if(err) {
        if (err.code === 'ENOENT') {
          console.error("data.json not found. No rainfall history.");
        } else {
          console.error("An error occurred trying to open data.json. No rainfall history.", err);
        }
      } else {
        try {
          debugger;
          const jsonData = JSON.parse(data);
          this.rainCounterTotal += jsonData.rainTotal;
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
        }
      }
    });

    ioe.setMode(IoExpander.PIN_R2, IoExpander.PIN_MODE_PU);
    ioe.setMode(IoExpander.PIN_R3, IoExpander.PIN_MODE_PP);
    ioe.setupSwitchCounter(switchCounterPin);
    ioe.setMode(IoExpander.PIN_R5, IoExpander.PIN_MODE_PU);
    ioe.output(IoExpander.PIN_R3, 0)
      .then(() => {
        ioe.setPinInterrupt(IoExpander.PIN_R4);
      });

    this.rainCounterTotal = 0;
    this.lastRainCounter = 0;

    this.rain = new Array(60).fill(null); // Keep track of rain counter every second for one minute
    this.rainIndex = 0; // Index of next rain array entry

    this.rainToday = 0;
    this.rainYesterday = 0;

    this.rainByHour = new Array(49).fill(null); // 1 entry for every 30 minutes + 1 entry
    this.rainByHourIndex = 0;

    setInterval(() => {
      let rainCounter = this.ioe.readSwitchCounter(IoExpander.PIN_R4);

      let rainPerSecond = this.rainCounterTotal;
      if (rainCounter < this.lastRainCounter) {
        this.rainCounterTotal += 128 - this.lastRainCounter;
        this.rainCounterTotal += rainCounter;
      } else {
        this.rainCounterTotal += rainCounter - this.lastRainCounter;
      }
      this.lastRainCounter = rainCounter;
      rainPerSecond = this.rainCounterTotal - rainPerSecond;
      this.rain[this.rainIndex] = rainPerSecond;

      this.rainToday += rainPerSecond;
      this.rainByHour[this.rainByHourIndex] += rainPerSecond;

      this.rainIndex++;
      if(this.rainIndex >= this.rain.length) {
        this.rainIndex = 0;
      }

      let now = new Date();
      if(this.tStart.getDay() !== now.getDay()) {
        this.tStart = new Date();
        this.rainYesterday = this.rainToday;
        this.rainToday = 0;
      }
    }, 1000);

    setInterval(() => {
      this.rainByHourIndex++;
      if(this.rainByHourIndex >= this.rainByHour.length) {
        this.rainByHourIndex = 0;
      }
    }, 1800000); // Every 30 minutes

    process.on('exit', (code) => {
        console.log(`Process is exiting with code: ${code}`);
        // Perform any cleanup or final actions here
        try {
          const data = JSON.stringify({rainTotal: this.rainCounterTotal, rainToday: this.rainToday, rainYesterDay: this.rainYesterday});
          fs.writeFileSync(HISTORY_FILE, data, 'utf8');
        } catch (err) {
          console.error('Error writing file:', err);
        }
    });
    
    process.on('SIGINT', () => {
        // Perform cleanup or actions here before the program is forcefully stopped
        process.exit();
    });
  }

  // Return mm for last minute
  getRainfall() {
    let rainfall = this.rain.reduce((previousValue, currentValue) => previousValue + currentValue, 0) * RAIN_MM_PER_TICK;
    return rainfall;
  }

  getRainfallTotal() {
    let rainfall = this.rainCounterTotal * RAIN_MM_PER_TICK;
    return rainfall;
  }

  // Get the mm for the last 24 hours
  getRainfall24Hours() {
    let rainfall = this.rainByHour.reduce((previousValue, currentValue) => previousValue + currentValue, 0);
    let prevIndex = this.rainByHourIndex - 1;
    if(prevIndex < 0) {
      prevIndex = this.rainByHour.length - 1;
    }
    rainfall -= this.rainByHour[prevIndex];
    return rainfall * RAIN_MM_PER_TICK;
  }

  getRainfallYesterday() {
    return this.rainYesterday * RAIN_MM_PER_TICK;
  }

  getRainfallToday() {
    return this.rainToday * RAIN_MM_PER_TICK;
  }
}

module.exports = {
  WindSpeed,
  WindVane,
  Rain
};