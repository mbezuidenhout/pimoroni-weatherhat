import { IoExpander } from '../ioe.mjs';

const ioe = new IoExpander({i2c_addr: 0x12, interrupt_pin: 4});

ioe.getChipId()
    .then((buffer) => {
        console.log(`Chip ID is 0x` + buffer.toString('hex'));
    })
    .catch((err) => console.error(`getChipId failed: ${err}`));

/*
// Wind vane
ioe.set_adc_vref(3.3);
ioe.set_mode(PIN_WINDVANE, io.ADC);

// Anemometer
ioe.set_mode(PIN_ANEMOMETER, io.OUT);

// Rain sensor
ioe.set_mode(PIN_R2, io.IN_PU);
*/