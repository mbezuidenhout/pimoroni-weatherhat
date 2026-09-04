const IoExpander = require('../ioe');

async function test() {
    console.log('Creating IO Expander...');

    const ioe = new IoExpander({
        i2c_addr: 0x12,
        smbus_id: 1
    });

    console.log('Waiting for I2C initialisation...');
    await ioe.ready;

    console.log('I2C initialised successfully.');

    console.log('Resetting IO Expander...');
    await ioe.reset();

    console.log('Reset successful.');
}

test()
    .then(() => {
        console.log('TEST PASSED');
        process.exit(0);
    })
    .catch(error => {
        console.error('TEST FAILED');
        console.error(error);
        process.exit(1);
    });
