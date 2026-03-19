import { calculateLateInterest, calculateLatePenalty } from './services/accountantService.ts';

console.log("--- STARTING ACCOUNTANT LOGIC TEST ---");

// Test Interest
const interest = calculateLateInterest(1000, new Date('2026-01-01'), new Date('2026-01-31'));
console.log(`Interest (1000, 30 days): Got ${interest} | Expected approx 8.22 | Result: ${Math.abs(interest - 8.22) < 0.1 ? 'PASS' : 'FAIL'}`);

// Test Penalties
const itbmsPenalty = calculateLatePenalty('ITBMS', 3, true);
console.log(`ITBMS Penalty (3 months): Got ${itbmsPenalty} | Expected 30 | Result: ${itbmsPenalty === 30 ? 'PASS' : 'FAIL'}`);

const isrJuridico = calculateLatePenalty('ISR_JURIDICO', 1, true);
console.log(`ISR Juridico Penalty: Got ${isrJuridico} | Expected 500 | Result: ${isrJuridico === 500 ? 'PASS' : 'FAIL'}`);

console.log("--- TEST FINISHED ---");
