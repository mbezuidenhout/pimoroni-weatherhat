const I2C_ADDR = 0x18;
const CHIP_ID = 0x6AE2;
const CHIP_VERSION = 2;
const REG_CHIP_ID_L = 0xFA;
const REG_CHIP_ID_H = 0xFB;
const REG_VERSION = 0xFC;

// Rotary encoder
const REG_ENC_EN = 0x04
const BIT_ENC_EN_1 = 0
const BIT_ENC_MICROSTEP_1 = 1
const BIT_ENC_EN_2 = 2
const BIT_ENC_MICROSTEP_2 = 3
const BIT_ENC_EN_3 = 4
const BIT_ENC_MICROSTEP_3 = 5
const BIT_ENC_EN_4 = 6
const BIT_ENC_MICROSTEP_4 = 7
const REG_ENC_1_CFG = 0x05
const REG_ENC_1_COUNT = 0x06
const REG_ENC_2_CFG = 0x07
const REG_ENC_2_COUNT = 0x08
const REG_ENC_3_CFG = 0x09
const REG_ENC_3_COUNT = 0x0A
const REG_ENC_4_CFG = 0x0B
const REG_ENC_4_COUNT = 0x0C

// Cap touch
const REG_CAPTOUCH_EN = 0x0D
const REG_CAPTOUCH_CFG = 0x0E
const REG_CAPTOUCH_0 = 0x0F  // First of 8 bytes from 15-22

// Switch counters
const REG_SWITCH_EN_P0 = 0x17
const REG_SWITCH_EN_P1 = 0x18
const REG_SWITCH_P00 = 0x19  // First of 8 bytes from 25-40
const REG_SWITCH_P10 = 0x21  // First of 8 bytes from 33-49
const REG_USER_FLASH = 0xD0
const REG_FLASH_PAGE = 0xF0
const REG_DEBUG = 0xF8
const REG_P0 = 0x40       // protect_bits 2 # Bit addressing
const REG_SP = 0x41       // Read only
const REG_DPL = 0x42      // Read only
const REG_DPH = 0x43      // Read only
const REG_RCTRIM0 = 0x44  // Read only
const REG_RCTRIM1 = 0x45  // Read only
const REG_RWK = 0x46
const REG_PCON = 0x47     // Read only
const REG_TCON = 0x48
const REG_TMOD = 0x49
const REG_TL0 = 0x4A
const REG_TL1 = 0x4B
const REG_TH0 = 0x4C
const REG_TH1 = 0x4D
const REG_CKCON = 0x4E
const REG_WKCON = 0x4F    // Read only
const REG_P1 = 0x50       // protect_bits 3 6 # Bit addressing
const REG_SFRS = 0x51     // TA protected # Read only
const REG_CAPCON0 = 0x52
const REG_CAPCON1 = 0x53
const REG_CAPCON2 = 0x54
const REG_CKDIV = 0x55
const REG_CKSWT = 0x56    // TA protected # Read only
const REG_CKEN = 0x57     // TA protected # Read only
const REG_SCON = 0x58
const REG_SBUF = 0x59
const REG_SBUF_1 = 0x5A
const REG_EIE = 0x5B      // Read only
const REG_EIE1 = 0x5C     // Read only
const REG_CHPCON = 0x5F   // TA protected # Read only
const REG_P2 = 0x60       // Bit addressing
const REG_AUXR1 = 0x62
const REG_BODCON0 = 0x63  // TA protected
const REG_IAPTRG = 0x64   // TA protected # Read only
const REG_IAPUEN = 0x65   // TA protected # Read only
const REG_IAPAL = 0x66    // Read only
const REG_IAPAH = 0x67    // Read only
const REG_IE = 0x68       // Read only
const REG_SADDR = 0x69
const REG_WDCON = 0x6A    // TA protected
const REG_BODCON1 = 0x6B  // TA protected
const REG_P3M1 = 0x6C
const REG_P3S = 0xC0      // Page 1 # Reassigned from 0x6c to avoid collision
const REG_P3M2 = 0x6D
const REG_P3SR = 0xC1     // Page 1 # Reassigned from 0x6d to avoid collision
const REG_IAPFD = 0x6E    // Read only
const REG_IAPCN = 0x6F    // Read only
const REG_P3 = 0x70       // Bit addressing
const REG_P0M1 = 0x71     // protect_bits  2
const REG_P0S = 0xC2      // Page 1 # Reassigned from 0x71 to avoid collision
const REG_P0M2 = 0x72     // protect_bits  2
const REG_P0SR = 0xC3     // Page 1 # Reassigned from 0x72 to avoid collision
const REG_P1M1 = 0x73     // protect_bits  3 6
const REG_P1S = 0xC4      // Page 1 # Reassigned from 0x73 to avoid collision
const REG_P1M2 = 0x74     // protect_bits  3 6
const REG_P1SR = 0xC5     // Page 1 # Reassigned from 0x74 to avoid collision
const REG_P2S = 0x75
const REG_IPH = 0x77      // Read only
const REG_PWMINTC = 0xC6  // Page 1 # Read only # Reassigned from 0x77 to avoid collision
const REG_IP = 0x78       // Read only
const REG_SADEN = 0x79
const REG_SADEN_1 = 0x7A
const REG_SADDR_1 = 0x7B
const REG_I2DAT = 0x7C    // Read only
const REG_I2STAT = 0x7D   // Read only
const REG_I2CLK = 0x7E    // Read only
const REG_I2TOC = 0x7F    // Read only
const REG_I2CON = 0x80    // Read only
const REG_I2ADDR = 0x81   // Read only
const REG_ADCRL = 0x82
const REG_ADCRH = 0x83
const REG_T3CON = 0x84
const REG_PWM4H = 0xC7    // Page 1 # Reassigned from 0x84 to avoid collision
const REG_RL3 = 0x85
const REG_PWM5H = 0xC8    // Page 1 # Reassigned from 0x85 to avoid collision
const REG_RH3 = 0x86
const REG_PIOCON1 = 0xC9  // Page 1 # Reassigned from 0x86 to avoid collision
const REG_TA = 0x87       // Read only
const REG_T2CON = 0x88
const REG_T2MOD = 0x89
const REG_RCMP2L = 0x8A
const REG_RCMP2H = 0x8B
const REG_TL2 = 0x8C
const REG_PWM4L = 0xCA    // Page 1 # Reassigned from 0x8c to avoid collision
const REG_TH2 = 0x8D
const REG_PWM5L = 0xCB    // Page 1 # Reassigned from 0x8d to avoid collision
const REG_ADCMPL = 0x8E
const REG_ADCMPH = 0x8F
const REG_PSW = 0x90      // Read only
const REG_PWMPH = 0x91
const REG_PWM0H = 0x92
const REG_PWM1H = 0x93
const REG_PWM2H = 0x94
const REG_PWM3H = 0x95
const REG_PNP = 0x96
const REG_FBD = 0x97
const REG_PWMCON0 = 0x98
const REG_PWMPL = 0x99
const REG_PWM0L = 0x9A
const REG_PWM1L = 0x9B
const REG_PWM2L = 0x9C
const REG_PWM3L = 0x9D
const REG_PIOCON0 = 0x9E
const REG_PWMCON1 = 0x9F
const REG_ACC = 0xA0      // Read only
const REG_ADCCON1 = 0xA1
const REG_ADCCON2 = 0xA2
const REG_ADCDLY = 0xA3
const REG_C0L = 0xA4
const REG_C0H = 0xA5
const REG_C1L = 0xA6
const REG_C1H = 0xA7
const REG_ADCCON0 = 0xA8
const REG_PICON = 0xA9    // Read only
const REG_PINEN = 0xAA    // Read only
const REG_PIPEN = 0xAB    // Read only
const REG_PIF = 0xAC      // Read only
const REG_C2L = 0xAD
const REG_C2H = 0xAE
const REG_EIP = 0xAF      // Read only
const REG_B = 0xB0        // Read only
const REG_CAPCON3 = 0xB1
const REG_CAPCON4 = 0xB2
const REG_SPCR = 0xB3
const REG_SPCR2 = 0xCC    // Page 1 # Reassigned from 0xb3 to avoid collision
const REG_SPSR = 0xB4
const REG_SPDR = 0xB5
const REG_AINDIDS0 = 0xB6
const REG_AINDIDS1 = null  // Added to have common code with SuperIO
const REG_EIPH = 0xB7     // Read only
const REG_SCON_1 = 0xB8
const REG_PDTEN = 0xB9    // TA protected
const REG_PDTCNT = 0xBA   // TA protected
const REG_PMEN = 0xBB
const REG_PMD = 0xBC
const REG_EIP1 = 0xBE     // Read only
const REG_EIPH1 = 0xBF    // Read only
const REG_INT = 0xF9
const MASK_INT_TRIG = 0x1
const MASK_INT_OUT = 0x2
const BIT_INT_TRIGD = 0
const BIT_INT_OUT_EN = 1
const BIT_INT_PIN_SWAP = 2  // 0 = P1.3, 1 = P0.0
const REG_INT_MASK_P0 = 0x00
const REG_INT_MASK_P1 = 0x01
const REG_INT_MASK_P3 = 0x03
const REG_ADDR = 0xFD
const REG_CTRL = 0xFE     // 0 = Sleep, 1 = Reset, 2 = Read Flash, 3 = Write Flash, 4 = Addr Unlock
const MASK_CTRL_SLEEP = 0x1
const MASK_CTRL_RESET = 0x2
const MASK_CTRL_FREAD = 0x4
const MASK_CTRL_FWRITE = 0x8
const MASK_CTRL_ADDRWR = 0x10

// Special mode registers, use a bit-addressing scheme to avoid
// writing the *whole* port and smashing the i2c pins
const BIT_ADDRESSED_REGS = [REG_P0, REG_P1, REG_P2, REG_P3]

module.exports = {
    I2C_ADDR,
    CHIP_ID,
    CHIP_VERSION,
    REG_CHIP_ID_L,
    REG_CHIP_ID_H,
    REG_VERSION,
    REG_ENC_EN,
    BIT_ENC_EN_1,
    BIT_ENC_MICROSTEP_1,
    BIT_ENC_EN_2,
    BIT_ENC_MICROSTEP_2,
    BIT_ENC_EN_3,
    BIT_ENC_MICROSTEP_3,
    BIT_ENC_EN_4,
    BIT_ENC_MICROSTEP_4,
    REG_ENC_1_CFG,
    REG_ENC_1_COUNT,
    REG_ENC_2_CFG,
    REG_ENC_2_COUNT,
    REG_ENC_3_CFG,
    REG_ENC_3_COUNT,
    REG_ENC_4_CFG,
    REG_ENC_4_COUNT,
    REG_CAPTOUCH_EN,
    REG_CAPTOUCH_CFG,
    REG_CAPTOUCH_0,
    REG_SWITCH_EN_P0,
    REG_SWITCH_EN_P1,
    REG_SWITCH_P00,
    REG_SWITCH_P10,
    REG_USER_FLASH,
    REG_FLASH_PAGE,
    REG_DEBUG,
    REG_P0,
    REG_SP,
    REG_DPL,
    REG_DPH,
    REG_RCTRIM0,
    REG_RCTRIM1,
    REG_RWK,
    REG_PCON,
    REG_TCON,
    REG_TMOD,
    REG_TL0,
    REG_TL1,
    REG_TH0,
    REG_TH1,
    REG_CKCON,
    REG_WKCON,
    REG_P1,
    REG_SFRS,
    REG_CAPCON0,
    REG_CAPCON1,
    REG_CAPCON2,
    REG_CKDIV,
    REG_CKSWT,
    REG_CKEN,
    REG_SCON,
    REG_SBUF,
    REG_SBUF_1,
    REG_EIE,
    REG_EIE1,
    REG_CHPCON,
    REG_P2,
    REG_AUXR1,
    REG_BODCON0,
    REG_IAPTRG,
    REG_IAPUEN,
    REG_IAPAL,
    REG_IAPAH,
    REG_IE,
    REG_SADDR,
    REG_WDCON,
    REG_BODCON1,
    REG_P3M1,
    REG_P3S,
    REG_P3M2,
    REG_P3SR,
    REG_IAPFD,
    REG_IAPCN,
    REG_P3,
    REG_P0M1,
    REG_P0S,
    REG_P0M2,
    REG_P0SR,
    REG_P1M1,
    REG_P1S,
    REG_P1M2,
    REG_P1SR,
    REG_P2S,
    REG_IPH,
    REG_PWMINTC,
    REG_IP,
    REG_SADEN,
    REG_SADEN_1,
    REG_SADDR_1,
    REG_I2DAT,
    REG_I2STAT,
    REG_I2CLK,
    REG_I2TOC,
    REG_I2CON,
    REG_I2ADDR,
    REG_ADCRL,
    REG_ADCRH,
    REG_T3CON,
    REG_PWM4H,
    REG_RL3,
    REG_PWM5H,
    REG_RH3,
    REG_PIOCON1,
    REG_TA,
    REG_T2CON,
    REG_T2MOD,
    REG_RCMP2L,
    REG_RCMP2H,
    REG_TL2,
    REG_PWM4L,
    REG_TH2,
    REG_PWM5L,
    REG_ADCMPL,
    REG_ADCMPH,
    REG_PSW,
    REG_PWMPH,
    REG_PWM0H,
    REG_PWM1H,
    REG_PWM2H,
    REG_PWM3H,
    REG_PNP,
    REG_FBD,
    REG_PWMCON0,
    REG_PWMPL,
    REG_PWM0L,
    REG_PWM1L,
    REG_PWM2L,
    REG_PWM3L,
    REG_PIOCON0,
    REG_PWMCON1,
    REG_ACC,
    REG_ADCCON1,
    REG_ADCCON2,
    REG_ADCDLY,
    REG_C0L,
    REG_C0H,
    REG_C1L,
    REG_C1H,
    REG_ADCCON0,
    REG_PICON,
    REG_PINEN,
    REG_PIPEN,
    REG_PIF,
    REG_C2L,
    REG_C2H,
    REG_EIP,
    REG_B,
    REG_CAPCON3,
    REG_CAPCON4,
    REG_SPCR,
    REG_SPCR2,
    REG_SPSR,
    REG_SPDR,
    REG_AINDIDS0,
    REG_AINDIDS1,
    REG_EIPH,
    REG_SCON_1,
    REG_PDTEN,
    REG_PDTCNT,
    REG_PMEN,
    REG_PMD,
    REG_EIP1,
    REG_EIPH1,
    REG_INT,
    MASK_INT_TRIG,
    MASK_INT_OUT,
    BIT_INT_TRIGD,
    BIT_INT_OUT_EN,
    BIT_INT_PIN_SWAP,
    REG_INT_MASK_P0,
    REG_INT_MASK_P1,
    REG_INT_MASK_P3,
    REG_ADDR,
    REG_CTRL,
    MASK_CTRL_SLEEP,
    MASK_CTRL_RESET,
    MASK_CTRL_FREAD,
    MASK_CTRL_FWRITE,
    MASK_CTRL_ADDRWR,
    BIT_ADDRESSED_REGS
  };