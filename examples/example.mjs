import { IoExpander } from '../ioe.mjs';

const ioe = new IoExpander({i2c_addr: 0x12, interrupt_pin: 4});

const keypress = async () => {
  process.stdin.setRawMode(true)
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false)
    resolve()
  }))
}

//await keypress();

await ioe.getChipId()
    .then((buffer) => {
        console.log(`Chip ID is 0x` + buffer.toString('hex'));
        ioe.reset()
            .then(() => {
		          console.log(`Reset success`);
            })
            .catch((err) => console.error(`reset failed: ${err}`));
    })
    .catch((err) => console.error(`getChipId failed: ${err}`));

// Wind vane
ioe.setAdcVref(3.3);
ioe.setMode(IoExpander.PIN_WINDVANE, IoExpander.PIN_MODE_ADC);

console.log('ADC mode set');

const readWindDir = async () => {
  let windDirRaw = ioe.adcInput(IoExpander.PIN_WINDVANE);
  console.log(`Wind raw: ` + windDirRaw);
  setTimeout(readWindDir, 1000);
};

readWindDir();

/*
// Anemometer
ioe.set_mode(PIN_ANEMOMETER, io.OUT);

// Rain sensor
ioe.set_mode(PIN_R2, io.IN_PU);
*/
