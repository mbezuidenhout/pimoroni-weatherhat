const IoExpander = require('../ioe');
const { WindSpeed } = require('../weather');

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

async function testWindSpeed() {
    console.log('Pimoroni Weather HAT - Wind Speed Test');
    console.log('---------------------------------------');

    let windSpeed;

    try {
        console.log('Initialising IO Expander...');

        const ioe = new IoExpander({
            i2c_addr: 0x12,
            smbus_id: 1
        });

        await ioe.ready;

        console.log('IO Expander ready.');

        windSpeed = new WindSpeed({
            ioe,
            unit: 'm/s'
        });

        await windSpeed.ready;

        console.log('Wind speed sensor ready.');
        console.log('Collecting wind speed samples...\n');

        /*
         * WindSpeed samples the anemometer approximately once
         * per second. Give it enough time to collect several
         * samples before testing the result.
         */
        for (let i = 0; i < 5; i++) {
            await sleep(1000);

            const speed = windSpeed.getWindSpeed();

            console.log(
                `Sample ${i + 1}: ${speed.toFixed(2)} m/s`
            );

            if (
                typeof speed !== 'number' ||
                !Number.isFinite(speed) ||
                speed < 0
            ) {
                throw new Error(
                    `Invalid wind speed returned: ${speed}`
                );
            }
        }

        const currentSpeed =
            windSpeed.getWindSpeed();

        const average1Min =
            windSpeed.getWindSpeed1MinAvg();

        const average5Min =
            windSpeed.getWindSpeed5MinAvg();

        console.log('\nCurrent readings:');
        console.log(
            `Current:       ${currentSpeed.toFixed(2)} m/s`
        );

        if (average1Min !== null) {
            console.log(
                `1 min average: ${average1Min.toFixed(2)} m/s`
            );
        }

        if (average5Min !== null) {
            console.log(
                `5 min average: ${average5Min.toFixed(2)} m/s`
            );
        }

        /*
         * Validate current wind speed.
         */
        if (
            typeof currentSpeed !== 'number' ||
            !Number.isFinite(currentSpeed) ||
            currentSpeed < 0
        ) {
            throw new Error(
                `Invalid current wind speed: ${currentSpeed}`
            );
        }

        /*
         * Once samples have been collected, both averages
         * should contain valid numeric values.
         */
        if (
            average1Min === null ||
            typeof average1Min !== 'number' ||
            !Number.isFinite(average1Min) ||
            average1Min < 0
        ) {
            throw new Error(
                `Invalid 1 minute average: ${average1Min}`
            );
        }

        if (
            average5Min === null ||
            typeof average5Min !== 'number' ||
            !Number.isFinite(average5Min) ||
            average5Min < 0
        ) {
            throw new Error(
                `Invalid 5 minute average: ${average5Min}`
            );
        }

        console.log('\nTEST PASSED');
    } catch (error) {
        console.error('\nTEST FAILED');
        console.error(error);
        process.exitCode = 1;
    } finally {
        /*
         * The WindSpeed class runs a sampling timer.
         * Stop it so Node.js can exit cleanly.
         */
        if (windSpeed) {
            windSpeed.stop();
        }
    }
}

testWindSpeed();
