/** Integer Pyramid's level-bank shapes (numberPyramidLevelsBank.server.ts). */
export interface NumberPyramidBankBoard { rows: 3 | 4 | 5 | 6; givens: (number | null)[]; tray: number[]; solution: number[] }
export interface NumberPyramidBankEntry { pyramids: NumberPyramidBankBoard[] }
