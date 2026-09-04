/*
  ioe.js

  A Node.js I2C module for the Pimoroni IOExpander based on the Nuvoton MS51.

  Uses the maintained `i2c` package, which exposes an asynchronous callback API.
  All hardware operations in this class therefore return Promises.
*/

'use strict';

const ioeregs = require('./ioe-regs.js');
const I2C = require('i2c');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class IoExpander {
    static PIN_MODE_IO  = 0b00000;
    static PIN_MODE_PP  = 0b00001;
    static PIN_MODE_IN  = 0b00010;
    static PIN_MODE_PU  = 0b10000;
    static PIN_MODE_OD  = 0b00011;
    static PIN_MODE_PWM = 0b00101;
    static PIN_MODE_ADC = 0b01010;

    static PIN_WINDVANE = 8;
    static PIN_ANE1 = 5;
    static PIN_ANE2 = 6;
    static PIN_R2 = 3;
    static PIN_R3 = 7;
    static PIN_R4 = 2;
    static PIN_R5 = 1;

    static PINS = [
        {port: 1, pin: 5, pwmPiocon: [1,5], pwmDefine: [0,5], encChannel: 1},
        {port: 1, pin: 0, pwmPiocon: [0,2], pwmDefine: [0,2], encChannel: 2},
        {port: 1, pin: 2, pwmPiocon: [0,0], pwmDefine: [0,0], encChannel: 3},
        {port: 1, pin: 4, pwmPiocon: [1,1], pwmDefine: [0,1], encChannel: 4},
        {port: 0, pin: 0, pwmPiocon: [0,3], pwmDefine: [0,3], encChannel: 5},
        {port: 0, pin: 1, pwmPiocon: [0,4], pwmDefine: [0,4], encChannel: 6},
        {port: 1, pin: 1, adcChannel: 7, pwmPioCon: [0,1], pwmDefine: [0,1], encChannel: 7},
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
        0: 'N', 45: 'NE', 90: 'E', 135: 'SE',
        180: 'S', 225: 'SW', 270: 'W', 315: 'NW'
    };

    static REGS_M1 = [ioeregs.REG_P0M1, ioeregs.REG_P1M1, -1, ioeregs.REG_P3M1];
    static REGS_M2 = [ioeregs.REG_P0M2, ioeregs.REG_P1M2, -1, ioeregs.REG_P3M2];
    static REGS_P = [ioeregs.REG_P0, ioeregs.REG_P1, ioeregs.REG_P2, ioeregs.REG_P3];
    static REGS_PS = [ioeregs.REG_P0S, ioeregs.REG_P1S, ioeregs.REG_P2S, ioeregs.REG_P3S];
    static REGS_INT_MASK_P = [ioeregs.REG_INT_MASK_P0, ioeregs.REG_INT_MASK_P1, -1, ioeregs.REG_INT_MASK_P3];

    constructor({i2c_addr = 0x12, smbus_id = 1, vref = 3.3} = {}) {
        this.i2cAddress = i2c_addr;
        this.i2cBusNo = smbus_id;
        this.vref = vref;
        this.debug = false;
        this.chipId = null;

        this.i2cBus = new I2C(this.i2cAddress, {
            device: `/dev/i2c-${this.i2cBusNo}`
        });

        this.ready = new Promise((resolve, reject) => {
            const onOpen = async () => {
                cleanup();
                try {
                    const buffer = await this.#getChipId();
                    this.chipId = buffer.readUInt16BE(0);
                    if (this.chipId !== ioeregs.CHIP_ID) {
                        throw new Error(
                            `Chip ID '0x${this.chipId.toString(16)}' does not match expected value of '0x${ioeregs.CHIP_ID.toString(16)}'`
                        );
                    }
                    resolve(this);
                } catch (err) {
                    reject(err);
                }
            };
            const onError = (err) => {
                cleanup();
                reject(err);
            };
            const cleanup = () => {
                this.i2cBus.removeListener('open', onOpen);
                this.i2cBus.removeListener('error', onError);
            };
            this.i2cBus.once('open', onOpen);
            this.i2cBus.once('error', onError);
        });
    }

    #writeBytes(reg, data) {
        return new Promise((resolve, reject) => {
            this.i2cBus.writeBytes(reg, Buffer.from(data), (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    #readBytes(reg, length) {
        return new Promise((resolve, reject) => {
            this.i2cBus.readBytes(reg, length, (err, data) => {
                if (err) return reject(err);
                resolve(Buffer.from(data));
            });
        });
    }

    async #writeByte(reg, value) {
        await this.#writeBytes(reg, [value & 0xff]);
    }

    async #readByte(reg) {
        const buffer = await this.#readBytes(reg, 1);
        return buffer[0];
    }

    async #getChipId() {
        // Preserve the transaction sequence used by the original driver.
        await this.#writeBytes(ioeregs.REG_CHIP_ID_L, [0x00, 0x00]);
        return this.#readBytes(ioeregs.REG_CHIP_ID_L, 2);
    }

    async reset() {
        await this.ready;
        await this.setBits(ioeregs.REG_CTRL, ioeregs.MASK_CTRL_RESET);

        const maxRetries = 3;
        for (let retry = 0; retry < maxRetries; retry++) {
            try {
                const byte = await this.#readByte(ioeregs.REG_USER_FLASH);
                if (byte === 0x78) return;
            } catch (err) {
                if (retry === maxRetries - 1) throw err;
            }
            await delay(2);
        }
        throw new Error('Timeout reached waiting for reset');
    }

    async clrBits(reg, bits, mask = null) {
        if (ioeregs.BIT_ADDRESSED_REGS.includes(reg)) {
            return this.setBits(reg, bits & 0b111, 0b0111);
        }
        if (mask === null) {
            mask = bits;
            bits = 0;
        }
        return this.setBits(reg, bits, mask);
    }

    async setBits(reg, bits, mask = null) {
        await this.ready;

        if (ioeregs.BIT_ADDRESSED_REGS.includes(reg)) {
            if (mask === null) mask = 0b1000;
            for (let bit = 0; bit < 8; bit++) {
                if (bits & (1 << bit)) {
                    await this.#writeByte(reg, (0b1000 & mask) | (bit & 0b111));
                }
            }
            return;
        }

        if (mask === null) mask = bits;
        const current = await this.#readByte(reg);
        bits &= 0xff;
        mask &= 0xff;
        const next = (current & (~mask & 0xff)) | (bits & mask);
        await this.#writeByte(reg, next);
    }

    setAdcVref(vref) {
        this.vref = vref;
    }

    getPin(pin) {
        if (pin < 1 || pin > 14) {
            throw new Error('Pin number not in the range 1-14');
        }
        return IoExpander.PINS[pin - 1];
    }

    async setMode(pin, mode, schmittTrigger = false, invert = false) {
        await this.ready;
        const gpioMode = mode & 0b11;
        const initialState = mode >> 4;
        const ioPin = this.getPin(pin);

        if (mode === IoExpander.PIN_MODE_ADC) {
            await this.enableAdc();
        }

        let pm1 = await this.#readByte(IoExpander.REGS_M1[ioPin.port]);
        let pm2 = await this.#readByte(IoExpander.REGS_M2[ioPin.port]);

        pm1 &= 255 - (1 << ioPin.pin);
        pm2 &= 255 - (1 << ioPin.pin);
        pm1 |= (gpioMode >> 1) << ioPin.pin;
        pm2 |= (gpioMode & 0b1) << ioPin.pin;

        await this.#writeByte(IoExpander.REGS_M1[ioPin.port], pm1);
        await this.#writeByte(IoExpander.REGS_M2[ioPin.port], pm2);

        if ([IoExpander.PIN_MODE_PU, IoExpander.PIN_MODE_IN].includes(mode)) {
            if (schmittTrigger) {
                await this.setBits(IoExpander.REGS_PS[ioPin.port], 1 << ioPin.pin);
            } else {
                await this.clrBits(IoExpander.REGS_PS[ioPin.port], 1 << ioPin.pin);
            }
        }

        ioPin.inverted = mode === IoExpander.PIN_MODE_PP && invert ? 1 : 0;
        ioPin.mode = mode;
        await this.#writeByte(IoExpander.REGS_P[ioPin.port], (initialState << 3) | ioPin.pin);
    }

    async enableAdc() {
        await this.setBits(ioeregs.REG_ADCCON1, 0b1, 0b1);
    }

    async adcInput(pin, adcTimeout = 1) {
        await this.ready;
        const ioPin = this.getPin(pin);
        await this.#writeByte(ioeregs.REG_AINDIDS0, 1 << ioPin.adcChannel);

        let con0value = await this.#readByte(ioeregs.REG_ADCCON0);
        con0value &= 0x0f;
        con0value |= ioPin.adcChannel;
        con0value &= ~(1 << 7);
        con0value |= (1 << 6);
        await this.#writeByte(ioeregs.REG_ADCCON0, con0value);

        if (adcTimeout) {
            const maxRetries = 3;
            let ready = false;
            for (let retry = 0; retry < maxRetries; retry++) {
                const byte = await this.#readByte(ioeregs.REG_ADCCON0);
                if (byte & 0x80) {
                    ready = true;
                    break;
                }
                await delay(1);
            }
            if (!ready) {
                throw new Error('Timeout reached waiting for ADC read ready');
            }
        }

        const buffer = await this.#readBytes(ioeregs.REG_ADCRL, 2);
        return (((buffer[1] << 4) | buffer[0]) / 4095.0) * this.vref;
    }

    async output(pin, value, load = true, waitForLoad = true) {
        const ioPin = this.getPin(pin);
        if (ioPin.mode === IoExpander.PIN_MODE_PWM) {
            throw new Error('PWM code TODO');
        }
        if (value === 1) {
            await this.setBits(IoExpander.REGS_P[ioPin.port], 1 << ioPin.pin);
        } else {
            await this.clrBits(IoExpander.REGS_P[ioPin.port], 1 << ioPin.pin);
        }
    }

    async setPinInterrupt(pin, enabled = true) {
        const ioPin = this.getPin(pin);
        if (enabled) {
            await this.setBits(IoExpander.REGS_INT_MASK_P[ioPin.port], 1 << ioPin.pin);
        } else {
            await this.clrBits(IoExpander.REGS_INT_MASK_P[ioPin.port], 1 << ioPin.pin);
        }
    }

    async setupSwitchCounter(pin, mode = IoExpander.PIN_MODE_PU) {
        const ioPin = this.getPin(pin);
        if (![0, 1].includes(ioPin.port)) {
            throw new Error(`Pin ${pin} does not support switch counting`);
        }
        if (![IoExpander.PIN_MODE_IN, IoExpander.PIN_MODE_PU].includes(mode)) {
            throw new Error('Pin mode should be one of PIN_MODE_IN or PIN_MODE_PU');
        }

        await this.setMode(pin, mode, true);
        if (ioPin.port === 0) {
            await this.setBits(ioeregs.REG_SWITCH_EN_P0, 1 << ioPin.pin);
        } else {
            await this.setBits(ioeregs.REG_SWITCH_EN_P1, 1 << ioPin.pin);
        }
    }

    async readSwitchCounter(pin) {
        await this.ready;
        const ioPin = this.getPin(pin);
        if (![0, 1].includes(ioPin.port)) {
            throw new Error(`Pin ${pin} does not support switch counting`);
        }

        const reg = ioPin.port === 0
            ? ioeregs.REG_SWITCH_P00 + ioPin.pin
            : ioeregs.REG_SWITCH_P10 + ioPin.pin;
        const value = await this.#readByte(reg);
        return value & 0x7f;
    }

    async enableInterruptOut(pinSwap = false) {
        await this.setBits(ioeregs.REG_INT, 1 << ioeregs.BIT_INT_OUT_EN);
        if (pinSwap) {
            await this.clrBits(ioeregs.REG_INT, 1 << ioeregs.BIT_INT_PIN_SWAP);
        } else {
            await this.setBits(ioeregs.REG_INT, 1 << ioeregs.BIT_INT_PIN_SWAP);
        }
    }

    close() {
        this.i2cBus.close();
    }
}

module.exports = IoExpander;
