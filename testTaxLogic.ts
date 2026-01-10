import { calculatePanamaISR } from './services/taxCalculator.ts';

const testCases = [
    { income: 10000, expenses: 0, type: 'NATURAL', expected: 0 },
    { income: 20000, expenses: 0, type: 'NATURAL', expected: 1350 }, // (20000-11000) * 0.15 = 1350
    { income: 60000, expenses: 0, type: 'NATURAL', expected: 8350 }, // 5850 + (60000-50000) * 0.25 = 8350
    { income: 100000, expenses: 20000, type: 'JURIDICA', regime: 'NONE', expected: 20000 }, // (100000-20000) * 0.25 = 20000
    { income: 20000, expenses: 5000, type: 'JURIDICA', regime: 'MICRO', expected: 600 }, // (15000-11000) * 0.15 = 600
];

console.log("--- STARTING PANAMA ISR TEST ---");

testCases.forEach((t, i) => {
    const result = calculatePanamaISR(t.income, t.expenses, t.type as any, t.regime);
    const pass = Math.abs(result.estimatedTax - t.expected) < 0.01;
    console.log(`Test ${i + 1}: ${t.type} ${t.regime || ''} | Income: ${t.income} | Expected: ${t.expected} | Got: ${result.estimatedTax} | Result: ${pass ? 'PASS' : 'FAIL'}`);
});

console.log("--- TEST FINISHED ---");
