/*
  ioe.js

  A Node.js I2C module fo the Pimoroni IOExpander based on the Nuvoton MS51.

  See: https://www.nuvoton.com/export/resource-files/TRM_MS51_16KBFlash_Series_EN_Rev1.03.pdf
*/

'use strict';

import * as ioeregs from './ioe-regs.mjs';
import i2c from 'i2c-bus';

export class IoExpander {
    static PIN_MODE_IO  = 0b00000; // General IO mode
    static PIN_MODE_PP  = 0b00001; // Output, Push-Pull mode
    static PIN_MODE_IN  = 0b00010; // Input-only (high-impedance)
    static PIN_MODE_PU  = 0b10000; // Input with pull-up
    static PIN_MODE_OD  = 0b00011; // Output, open-drain mode
    static PIN_MODE_PWM = 0b00101; // PWM, output, push-pull mode
    static PIN_MODE_ADC = 0b01010; // ADC, input-only (high-impedance)

    static PIN_WINDVANE = 8     // P0.3 ANE6

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

    static windDirectionToDegrees = {
        0.9: 0,
        2.0: 45,
        3.0: 90,
        2.8: 135,
        2.5: 180,
        1.5: 225,
        0.3: 270,
        0.6: 315
    };

    static REGS_M1 = [ioeregs.REG_P0M1, ioeregs.REG_P1M1, -1, ioeregs.REG_P3M1];
    static REGS_M2 = [ioeregs.REG_P0M2, ioeregs.REG_P1M2, -1, ioeregs.REG_P3M2];

    static REGS_P = [ioeregs.REG_P0, ioeregs.REG_P1, ioeregs.REG_P2, ioeregs.REG_P3];
    static REGS_PS = [ioeregs.REG_P0, ioeregs.REG_P1, ioeregs.REG_P2, ioeregs.REG_P3];

    constructor({i2c_addr, interrupt_timeout=1.0, interrupt_pin=null, interrupt_pull_up=false, gpio=null,
        smbus_id=1, skip_chip_id_check=false, perform_reset=false}) {
        
        this.i2cAddress = i2c_addr;
        this.i2cBusNo = smbus_id;
        this.i2cBus = i2c.openSync(this.i2cBusNo);
        this.debug = false;
        this.vref = 3.3;
        this.adc_enabled = false;
        this.timeout = interrupt_timeout;
        this.interruptPin = interrupt_pin;
        this.gpio = gpio;
        this.encoderOffset = [0, 0, 0, 0];
        this.encoderLast = [0, 0, 0, 0];
    }

    getChipId() {
        return new Promise((resolve, reject) => {
            this.i2cBus.writeI2cBlock(this.i2cAddress, ioeregs.REG_CHIP_ID_L, 2, Buffer.from([0x00, 0x00]), (err) => {
                if(err) {
                    return reject(err);
                }
                const buffer = Buffer.alloc(2);
                this.i2cBus.readI2cBlock(this.i2cAddress, ioeregs.REG_CHIP_ID_L, 2, buffer, (err, bytesRead, buffer) => {
                    return err ? reject(err) : resolve(buffer);
                })
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

    setBits(reg, bits) {
        return new Promise((resolve, reject) => {
            if (reg in ioeregs.BIT_ADDRESSED_REGS) {
                return reject('Reserved register');
            } else {
                this.i2cBus.readByte(this.i2cAddress, reg, (err, res) => {
                    if(err) {
                        return reject(err);
                    } else {
                        this.i2cBus.writeByte(this.i2cAddress, reg, res | bits, (err) => {
                            return reject(err);
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

    getPinRegs() {

    }
    
    setMode(pin, mode, schmittTrigger=false, invert=false) {
        debugger;
        let gpioMode = mode & 0b11;
        let ioMode = (mode >> 2) & 0b11;
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

        this.i2cBus.writeByteSync(this.i2cAddress, IoExpander.REGS_P[ioPin.port], (initialState << 3) | ioPin.pin);
    }

    enableAdc() {
        this.setBits(ioeregs.REG_ADCCON1, 0b1);
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
            return buffer[1] << 4 | buffer[0];
        }
    }
}