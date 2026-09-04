const IoExpander = require('../ioe.js');
const {WindVane, WindSpeed, Rain} = require('../weather.js');

async function main() {
  const ioe = new IoExpander({i2c_addr: 0x12});

  await ioe.ready;
  console.log(`Chip ID is 0x${ioe.chipId.toString(16)}`);
  await ioe.reset();

  const windVane = new WindVane({ioe});
  const windSpeed = new WindSpeed({ioe});
  const rainfall = new Rain({ioe});

  await Promise.all([windVane.ready, windSpeed.ready, rainfall.ready]);

  const readWeather = async () => {
    try {
      console.log(`Wind direction: ${await windVane.getWindDirShortCardinal()}`);
      console.log(`Wind speed: ${windSpeed.getWindSpeed().toFixed(1)} m/s`);

      const windSpeed1Min = windSpeed.getWindSpeed1MinAvg();
      if (windSpeed1Min !== null) {
        console.log(`Wind speed 1 min avg: ${windSpeed1Min.toFixed(1)} m/s`);
      }

      const windSpeed5Min = windSpeed.getWindSpeed5MinAvg();
      if (windSpeed5Min !== null) {
        console.log(`Wind speed 5 min avg: ${windSpeed5Min.toFixed(1)} m/s`);
      }

      console.log(`Total recorded rainfall: ${rainfall.getRainfallTotal()} mm`);
      console.log(`24 hour recorded rainfall: ${rainfall.getRainfall24Hours()} mm`);
      console.log(`Rainfall today: ${rainfall.getRainfallToday()} mm`);
      console.log(`Rainfall in last minute: ${rainfall.getRainfall()} mm`);
    } catch (err) {
      console.error(err);
    }

    setTimeout(readWeather, 1000);
  };

  readWeather();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
