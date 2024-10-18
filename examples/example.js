const IoExpander = require('../ioe.js');
const { WindVane, WindSpeed, Rain } = require('../weather.js');
//const { Gpio } = require('pigpio');

const ioe = new IoExpander({i2c_addr: 0x12});

const keypress = async () => {
  process.stdin.setRawMode(true)
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false)
    resolve()
  }))
}

//keypress();

const reset = async () => {
  const interval = setInterval(() => {
    if(ioe.chipId != null) {
      clearInterval(interval);
      console.log(`Chip ID is 0x` + ioe.chipId.toString(16));

      
    }
  }, 100);
  
  await ioe.reset();

  let windVane = new WindVane({ioe: ioe});
  let windSpeed = new WindSpeed({ioe: ioe});
  let rainfall = new Rain({ioe: ioe});

  const readWindDir = async () => {
    
    console.log(`Wind direction: ` + windVane.getWindDirShortCardinal());
    console.log(`Wind speed: ` + windSpeed.getWindSpeed().toFixed(1) + ` m/s`);
    let windSpeed1Min = windSpeed.getWindSpeed1MinAvg();
    if(windSpeed1Min !== null) {
      console.log(`Wind speed 1 min avg: ` + windSpeed1Min.toFixed(1) + ` m/s`);
    }
    let windSpeed5Min = windSpeed.getWindSpeed5MinAvg();
    if(windSpeed5Min !== null) {
      console.log(`Wind speed 5 min avg: ` + windSpeed5Min.toFixed(1) + ` m/s`);
    }
    console.log(`Total recorded rainfall: ` + rainfall.getRainfallTotal() + ` mm`);
    console.log(`24 recorded rainfall: ` + rainfall.getRainfall24Hours() + ` mm`);
    console.log(`Rainfall today: ` + rainfall.getRainfallToday() + ` mm`);
    console.log(`Rainfall in last minute: ` + rainfall.getRainfall() + ` mm`);

    setTimeout(readWindDir, 1000);
  };

  readWindDir();
}

reset();