const IoExpander = require('../ioe');
const { WindVane } = require('../weather');

async function testWindVane() {
    console.log('Pimoroni Weather HAT - Wind Vane Test');
    console.log('--------------------------------------');

    try {
        console.log('Initialising IO Expander...');

        const ioe = new IoExpander({
            i2c_addr: 0x12,
            smbus_id: 1
        });

        await ioe.ready;

        console.log('IO Expander ready.');

        const windVane = new WindVane({ ioe });

        await windVane.ready;

        console.log('Wind vane ready.');
        console.log('Reading wind direction...\n');

        const degrees = await windVane.getWindDir();
        const direction = await windVane.getWindDirShortCardinal();

        console.log(`Wind direction: ${degrees.toFixed(1)}°`);
        console.log(`Cardinal:       ${direction}`);

        if (
            typeof degrees !== 'number' ||
            !Number.isFinite(degrees) ||
            degrees < 0 ||
            degrees >= 360
        ) {
            throw new Error(
                `Invalid wind direction returned: ${degrees}`
            );
        }

        console.log('\nTEST PASSED');
    } catch (error) {
        console.error('\nTEST FAILED');
        console.error(error);
        process.exitCode = 1;
    }
}

testWindVane();
