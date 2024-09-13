/*
  ioe.js

  A Node.js I2C module fo the Pimoroni IOExpander based on the Nuvoton MS51.

  See: https://www.nuvoton.com/export/resource-files/TRM_MS51_16KBFlash_Series_EN_Rev1.03.pdf
*/

'use strict';

import * as ioeregs from './ioe-regs.mjs';
import i2c from 'i2c-bus';

export class IoExpander {
    
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

    setBits(reg, bits) {
        return new Promise((resolve, reject) => {
            if (reg in ioeregs.BIT_ADDRESSED_REGS) {
                return reject('Reserved register');
            } else {
                this.i2cBus.readByte(this.i2cAddress, reg, (err, res) => {
                    if(err) {
                        return reject(err);
                    } else {
                        
                    }
                });
            }
        });
    }
}