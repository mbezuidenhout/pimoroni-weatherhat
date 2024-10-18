/*
  ioe.js

  A Node.js I2C module fo the Pimoroni IOExpander based on the Nuvoton MS51.

  See: https://www.nuvoton.com/export/resource-files/TRM_MS51_16KBFlash_Series_EN_Rev1.03.pdf
*/

'use strict';

const ioeregs = require('./ioe-regs.js');
const i2c = require('i2c-bus');

class IoExpander {
    static PIN_MODE_IO  = 0b00000; // General IO mode
    static PIN_MODE_PP  = 0b00001; // Output, Push-Pull mode
    static PIN_MODE_IN  = 0b00010; // Input-only (high-impedance)
    static PIN_MODE_PU  = 0b10000; // Input with pull-up
    static PIN_MODE_OD  = 0b00011; // Output, open-drain mode
    static PIN_MODE_PWM = 0b00101; // PWM, output, push-pull mode
    static PIN_MODE_ADC = 0b01010; // ADC, input-only (high-impedance)

    // Wind vane
    static PIN_WINDVANE = 8;     // P0.3 ANE6

    // Anemometer
    static PIN_ANE1 = 5;
    static PIN_ANE2 = 6;

    // Rain sensor
    static PIN_R2 = 3;         // P1.2
    static PIN_R3 = 7;         // P1.1
    static PIN_R4 = 2;         // P1.0
    static PIN_R5 = 1;         // P1.5

    /* IO Expander pins
     * Pin |  ADC   |  PWM   |  ENC  |
     * 1   |        | [CH 5] | CH 1  |
     * 2   |        | [CH 2] | CH 2  |
     * 3   |        | [CH 0] | CH 3  |
     * 4   |        | [CH 1] | CH 4  |
     * 5   |        | [CH 3] | CH 5  |
     * 6   |        | [CH 4] | CH 6  |
     * 7   | [CH 7] |  CH 1  | CH 7  |
     * 8   | [CH 6] |  CH 5  | CH 8  |
     * 9   | [CH 5] |  CH 3  | CH 9  |
     * 10  | [CH 1] |        | CH 10 |
     * 11  | [CH 3] |        | CH 11 |
     * 12  | [CH 4] |  CH 2  | CH 12 |
     * 13  | [CH 2] |        | CH 13 |
     * 14  | [CH 0] |        | CH 14 |
     */ 
    static PINS = [
        {port: 1, pin: 5, pwmPiocon: [1,5], pwmDefine: [0,5], encChannel: 1}, // PWM pins
        {port: 1, pin: 0, pwmPiocon: [0,2], pwmDefine: [0,2], encChannel: 2},
        {port: 1, pin: 2, pwmPiocon: [0,0], pwmDefine: [0,0], encChannel: 3},
        {port: 1, pin: 4, pwmPiocon: [1,1], pwmDefine: [0,1], encChannel: 4},
        {port: 0, pin: 0, pwmPiocon: [0,3], pwmDefine: [0,3], encChannel: 5},
        {port: 0, pin: 1, pwmPiocon: [0,4], pwmDefine: [0,4], encChannel: 6},
        {port: 1, pin: 1, adcChannel: 7, pwmPioCon: [0,1], pwmDefine: [0,1], encChannel: 7}, // ADC/PWM pins
        {port: 0, pin: 3, adcChannel: 6, pwmPioCon: [0,5], pwmDefine: [0,5], encChannel: 8},
        {port: 0, pin: 4, adcChannel: 5, pwmPioCon: [1,3], pwmDefine: [0,3], encChannel: 9},
        {port: 3, pin: 0, adcChannel: 1, encChannel: 10},
        {port: 0, pin: 6, adcChannel: 3, encChannel: 11},
        {port: 0, pin: 5, adcChannel: 4, pwmPioCon: [1,2], pwmDefine: [0,2], encChannel: 12},
        {port: 0, pin: 7, adcChannel: 2, encChannel: 13},
        {port: 1, pin: 7, adcChannel: 0, encChannel: 14}
    ];

    static WIND_DIR_TO_DEGREES = {
        0.9: 0,
        2.0: 45,
        3.0: 90,
        2.8: 135,
        2.5: 180,
        1.5: 225,
        0.3: 270,
        0.6: 315
    };

    static WIND_DIR_TO_SHORT_CARDINAL = {
        0:   'N',
        45:  'NE',
        90:  'E',
        135: 'SE',
        180: 'S',
        225: 'SW',
        270: 'W',
        315: 'NW'
    };

    static REGS_M1 = [ioeregs.REG_P0M1, ioeregs.REG_P1M1, -1, ioeregs.REG_P3M1];
    static REGS_M2 = [ioeregs.REG_P0M2, ioeregs.REG_P1M2, -1, ioeregs.REG_P3M2];

    static REGS_P = [ioeregs.REG_P0, ioeregs.REG_P1, ioeregs.REG_P2, ioeregs.REG_P3];
    static REGS_PS = [ioeregs.REG_P0S, ioeregs.REG_P1S, ioeregs.REG_P2S, ioeregs.REG_P3S];

    static REGS_INT_MASK_P = [ioeregs.REG_INT_MASK_P0, ioeregs.REG_INT_MASK_P1, -1, ioeregs.REG_INT_MASK_P3];

    constructor({i2c_addr = 0x12, smbus_id = 1, vref = 3.3}) {
        this.i2cAddress = i2c_addr;
        this.i2cBusNo = smbus_id;
        this.i2cBus = i2c.openSync(this.i2cBusNo);
        this.debug = false;
        this.vref = vref;
        this.chipId = null;
        this.#getChipId()
            .then((buffer) => {
                this.chipId = buffer.readUInt16BE(0);
                if(this.chipId !== ioeregs.CHIP_ID) {
                    let chipId = this.chipId.toString(16);
                    let expectedChipId = ioeregs.CHIP_ID.toString(16);
                    throw new Error(`Chip ID '${chipId}' does not match expected value of '${expectedChipId}'`);
                }
            });
    }

    #getChipId() {
        return new Promise((resolve, reject) => {
            this.i2cBus.writeI2cBlockSync(this.i2cAddress, ioeregs.REG_CHIP_ID_L, 2, Buffer.from([0x00, 0x00]));
            const buffer = Buffer.alloc(2);
            this.i2cBus.readI2cBlock(this.i2cAddress, ioeregs.REG_CHIP_ID_L, 2, buffer, (err, bytesRead, buffer) => {
                return err ? reject(err) : resolve(buffer);
            });
        });
    }

    reset() {
        return new Promise((resolve, reject) => {
            this.setBits(ioeregs.REG_CTRL, ioeregs.MASK_CTRL_RESET)
                .then(() => {
                    let retryCount = 0;
                    const maxRetries = 3;
                    const checkReset = () => {
                        this.i2cBus.readByte(this.i2cAddress, ioeregs.REG_USER_FLASH, (err, byte) => {
                            if(err) {
                                setTimeout(checkReset, 2);
                            }
                            if(byte == 0x78) {
                                resolve();
                            } else {
                                retryCount++;
                                if(retryCount >= maxRetries) {
                                    reject(new Error('Timeout reached waiting for reset'));
                                } else {
                                    setTimeout(checkReset, 2);
                                }
                            }
                        });
                    }
                    checkReset();
                })
                .catch((err) => reject(err));
        });
    }

    clrBits(reg, bits, mask = null) {
        if (ioeregs.BIT_ADDRESSED_REGS.includes(reg)) {
            return this.setBits(reg, bits & 0b111, 0b0111);
        } else {
            if (mask === null) {
                mask = bits;
                bits = 0;
            }    
            return this.setBits(reg, bits, mask);
        }
    }

    setBits(reg, bits, mask = null) {
        return new Promise((resolve, reject) => {
            if (ioeregs.BIT_ADDRESSED_REGS.includes(reg)) {
                if (mask === null) {
                    mask = 0b1000;
                }
                for (let bit = 0; bit < 8; bit++) {
                    if (bits & (1 << bit)) {
                        this.i2cBus.writeByteSync(this.i2cAddress, reg, (0b1000 & mask) | (bit & 0b111));
                    }
                }
                //reject('Reserved register');
                resolve();
            } else {
                if (mask === null) {
                    mask = bits;
                }        
                this.i2cBus.readByte(this.i2cAddress, reg, (err, res) => {
                    if(err) {
                        return reject(err);
                    } else {
                        bits &= 0xff;
                        mask &= 0xff;

                        // Only apply bits indicated by mask
                        const clearedInput = res & (~mask);
                        const bitsToApply = bits & mask;

                        this.i2cBus.writeByte(this.i2cAddress, reg, clearedInput | bitsToApply, (err) => {
                            reject(err);
                        });
                        resolve();
                    }
                });
            }
        });
    }

    setAdcVref(vref) {
        this.vref = vref;
    }

    getPin(pin) {
        if (pin < 1 || pin > 14)
            throw new Error("Pin number not in the range 1-14");
        return IoExpander.PINS[pin - 1];
    }
    
    setMode(pin, mode, schmittTrigger = false, invert = false) {
        let gpioMode = mode & 0b11;
        let initialState = mode >> 4;
        let ioPin = this.getPin(pin);

        if (mode === IoExpander.PIN_MODE_ADC) {
            this.enableAdc();
        }
        
        let pm1 = this.i2cBus.readByteSync(this.i2cAddress, IoExpander.REGS_M1[ioPin.port]);
        let pm2 = this.i2cBus.readByteSync(this.i2cAddress, IoExpander.REGS_M2[ioPin.port]);

        // Clear the pm1 and pm2 bits
        pm1 &= 255 - (1 << ioPin.pin);
        pm2 &= 255 - (1 << ioPin.pin);

        // Set the new pm1 and pm2 bits according to our gpio_mode
        pm1 |= (gpioMode >> 1) << ioPin.pin;
        pm2 |= (gpioMode & 0b1) << ioPin.pin;

        this.i2cBus.writeByteSync(this.i2cAddress, IoExpander.REGS_M1[ioPin.port], pm1);
        this.i2cBus.writeByteSync(this.i2cAddress, IoExpander.REGS_M2[ioPin.port], pm2);

        // Setup Schmitt trigger
        if ([IoExpander.PIN_MODE_PU, IoExpander.PIN_MODE_IN].includes(mode)) {
            if(schmittTrigger) {
                this.setBits(IoExpander.REGS_PS[ioPin.port], 1 << ioPin.pin);
            } else {
                this.clrBits(IoExpander.REGS_PS[ioPin.port], 1 << ioPin.pin);
            }
        }

        // Invert pin if it is a basic output
        if (mode === IoExpander.PIN_MODE_PP && invert) {
            ioPin.inverted = 1;
        }

        this.i2cBus.writeByteSync(this.i2cAddress, IoExpander.REGS_P[ioPin.port], (initialState << 3) | ioPin.pin);
    }

    enableAdc() {
        this.setBits(ioeregs.REG_ADCCON1, 0b1, 0b1);
    }

    adcInput(pin, adcTimeout = 1) {
        let ioPin = this.getPin(pin);

        this.i2cBus.writeByteSync(this.i2cAddress, ioeregs.REG_AINDIDS0, 1 << ioPin.adcChannel);
        
        let con0value = this.i2cBus.readByteSync(this.i2cAddress, ioeregs.REG_ADCCON0);
        con0value = con0value & 0x0f;
        con0value = con0value | ioPin.adcChannel;

        con0value = con0value & ~(1 << 7)   // ADCF - Clear the conversion complete flag
        con0value = con0value | (1 << 6)    // ADCS - Set the ADC conversion start flag

        this.i2cBus.writeByteSync(this.i2cAddress, ioeregs.REG_ADCCON0, con0value);

        if( adcTimeout ) {
            let retryCount = 0;
            const maxRetries = 3;
            const checkADCReady = () => {
                this.i2cBus.readByteSync(this.i2cAddress, ioeregs.REG_ADCCON0, (err, byte) => {
                    if(err) {
                        setTimeout(checkADCReady, 1);
                    }
                    if(byte & 0x80) {
                        return true;
                    } else {
                        retryCount++;
                        if(retryCount >= maxRetries) {
                            reject(new Error('Timeout reached waiting for ADC read ready'));
                        } else {
                            setTimeout(checkADCReady, 1);
                        }
                    }
                });
            }
            checkADCReady();
            const buffer = Buffer.alloc(2);
            this.i2cBus.readI2cBlockSync(this.i2cAddress, ioeregs.REG_ADCRL, 2, buffer);
            return ((buffer[1] << 4 | buffer[0]) / 4095.0) * this.vref;
        }
    }

    output(pin, value, load = true, waitForLoad = true) {
        let ioPin = this.getPin(pin);

        return new Promise((resolve) => {
            if (ioPin.mode === IoExpander.PIN_MODE_PWM) {
                reject(new Error('PWM code TODO'));
            } else {
                if(value === 1) {
                    this.setBits(IoExpander.REGS_P[ioPin.port], 1 << ioPin.pin);
                } else {
                    this.clrBits(IoExpander.REGS_P[ioPin.port], 1 << ioPin.pin);
                }
                resolve();
            }
        });
    }

    setPinInterrupt(pin, enabled = true) {
        const ioPin = this.getPin(pin);
        if(enabled) {
            this.setBits(IoExpander.REGS_INT_MASK_P[ioPin.port], 1 << ioPin.pin);
        } else {
            this.clrBits(IoExpander.REGS_INT_MASK_P[ioPin.port], 1 << ioPin.pin);
        }
    }

    setupSwitchCounter(pin, mode = IoExpander.PIN_MODE_PU) {
        const ioPin = this.getPin(pin);
        if (![0, 1].includes(ioPin.port)) {
            throw new Error(`Pin ${pin} does not support switch counting`);
        }
        if (![IoExpander.PIN_MODE_IN, IoExpander.PIN_MODE_PU].includes(mode)) {
            throw new Error(`Pin mode should be one of PIN_MODE_IN or PIN_MODE_PU`);
        }

        this.setMode(pin, mode, true);

        if(ioPin.port === 0) {
            this.setBits(ioeregs.REG_SWITCH_EN_P0, 1 << ioPin.pin);
        } else {
            this.setBits(ioeregs.REG_SWITCH_EN_P1, 1 << ioPin.pin);
        }
    }

    readSwitchCounter(pin) {
        const ioPin = this.getPin(pin);

        if (![0,1].includes(ioPin.port)) {
            throw new Error(`Pin ${pin} does not support switch counting`);
        }

        let value = 0;
        if(ioPin.port === 0) {
            value = this.i2cBus.readByteSync(this.i2cAddress, ioeregs.REG_SWITCH_P00 + ioPin.pin);
        } else {
            value = this.i2cBus.readByteSync(this.i2cAddress, ioeregs.REG_SWITCH_P10 + ioPin.pin);
        }
        //this.setBits(ioeregs.REG_INT, 1 << ioeregs.BIT_INT_TRIGD);

        // value & 0x80 is the current GPIO state
        return value & 0x7f;
    }

    enableInterruptOut(pinSwap = false) {
        this.setBits(ioeregs.REG_INT, 1 << ioeregs.BIT_INT_OUT_EN);
        if(pinSwap) {
            this.clrBits(ioeregs.REG_INT, 1 << ioeregs.BIT_INT_PIN_SWAP);
        } else {
            this.setBits(ioeregs.REG_INT, 1 << ioeregs.BIT_INT_PIN_SWAP);
        }
    }
}

module.exports = IoExpander;