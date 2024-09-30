import { IoExpander } from '../ioe.mjs';
import { Gpio } from 'pigpio';

const ioe = new IoExpander({i2c_addr: 0x12, interrupt_pin: 4});

const keypress = async () => {
  process.stdin.setRawMode(true)
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false)
    resolve()
  }))
}

await keypress();

await ioe.getChipId()
    .then((buffer) => {
        console.log(`Chip ID is 0x` + buffer.toString('hex'));
        ioe.reset()
            .then(() => {
		          console.log(`Reset success`);
              readWindDir();
            })
            .catch((err) => console.error(`reset failed: ${err}`));
    })
    .catch((err) => console.error(`getChipId failed: ${err}`));

//let interruptPin = new Gpio(4, {mode: Gpio.INPUT, pullUpDown: Gpio.PUD_UP, edge: Gpio.FALLING_EDGE}); // Results in -123 error 2024/09/30
//interruptPin.glitchFilter(10000); // Ignore edges shorter than 10,000 microseconds
/*
interruptPin.on('alert', (level, tick) => {
  console.log(`Tick detected`);
});
*/

// Wind vane
ioe.setAdcVref(3.3);
ioe.setMode(IoExpander.PIN_WINDVANE, IoExpander.PIN_MODE_ADC);

ioe.setMode(IoExpander.PIN_ANE1, IoExpander.PIN_MODE_PP);
await ioe.output(IoExpander.PIN_ANE1, 0)
    .then(() => {
      ioe.setPinInterrupt(IoExpander.PIN_ANE2);
      ioe.setupSwitchCounter(IoExpander.PIN_ANE2);
      ioe.enableInterruptOut();
    })
    .catch((err) => console.error(`set mode failed: ${err}`));

console.log('ADC mode set');

const readWindDir = async () => {
  let windDirRaw = ioe.adcInput(IoExpander.PIN_WINDVANE);
  let windSpeed = ioe.readSwitchCounter(IoExpander.PIN_ANE2);
  let closest = Object.entries(IoExpander.WIND_DIR_TO_DEGREES).reduce((prev, curr) => {
    return Math.abs(curr[0] - windDirRaw) < Math.abs(prev[0] - windDirRaw) ? curr : prev;
  });
  let value = closest[1];
  console.log(`Wind raw: ` + value);
  console.log(`Wind speed: ` + windSpeed);
  setTimeout(readWindDir, 5000);
};

/*
// Anemometer
ioe.set_mode(PIN_ANEMOMETER, io.OUT);

// Rain sensor
ioe.set_mode(PIN_R2, io.IN_PU);
*/
