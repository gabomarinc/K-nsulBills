/**
 * Panama Tax Calculation Logic (DGI)
 * 
 * BRACKETS FOR PERSONA NATURAL (Individual):
 * - Up to $11,000: 0%
 * - $11,001 to $50,000: 15% on the excess of $11,000
 * - Over $50,000: $5,850 + 25% on the excess of $50,000
 * 
 * PERSONA JURIDICA (Corporate):
 * - Flat 25% on taxable income.
 * - Minimum tax (CAIR) exists but usually applies to revenues > $1.5M (not handled here for simplicity).
 */

export interface TaxCalculationResult {
    taxableIncome: number;
    estimatedTax: number;
    effectiveRate: number;
    brackets: { range: string, rate: string, amount: number }[];
}

export const calculatePanamaISR = (
    annualIncome: number,
    annualExpenses: number,
    entityType: 'NATURAL' | 'JURIDICA',
    specialRegime: string = 'NONE'
): TaxCalculationResult => {
    // 1. Calculate Taxable Income (Renta Neta Gravable)
    // Expenses are deductible if they are related to producing income.
    let taxableIncome = Math.max(0, annualIncome - annualExpenses);

    let estimatedTax = 0;
    const brackets = [];

    if (entityType === 'NATURAL') {
        // Brackets Natural
        if (taxableIncome <= 11000) {
            estimatedTax = 0;
            brackets.push({ range: '$0 - $11,000', rate: '0%', amount: 0 });
        } else if (taxableIncome <= 50000) {
            const excess = taxableIncome - 11000;
            estimatedTax = excess * 0.15;
            brackets.push({ range: '$0 - $11,000', rate: '0%', amount: 0 });
            brackets.push({ range: '$11,001 - $50,000', rate: '15%', amount: estimatedTax });
        } else {
            const baseTax = 5850; // Tax for first $50k
            const excess = taxableIncome - 50000;
            const excessTax = excess * 0.25;
            estimatedTax = baseTax + excessTax;
            brackets.push({ range: '$0 - $11,000', rate: '0%', amount: 0 });
            brackets.push({ range: '$11,001 - $50,000', rate: '15%', amount: 5850 });
            brackets.push({ range: '>$50,000', rate: '25%', amount: excessTax });
        }
    } else {
        // Brackets Juridica (Flat 25%)
        // Note: Micro/Small companies have special progressive rates in Panama, 
        // but for now we follow the general 25% or we can add the micro-business rule if regime is MICRO.

        if (specialRegime === 'MICRO') {
            // Panama Micro/Small Business Progressive Rates (simplified)
            // Usually applies up to $150k or $500k depending on specific DGI decrees
            if (taxableIncome <= 11000) {
                estimatedTax = 0;
            } else if (taxableIncome <= 50000) {
                estimatedTax = (taxableIncome - 11000) * 0.15;
            } else {
                estimatedTax = 5850 + (taxableIncome - 50000) * 0.25;
            }
            brackets.push({ range: 'Microempresa (SME Registry)', rate: 'Progressive', amount: estimatedTax });
        } else {
            estimatedTax = taxableIncome * 0.25;
            brackets.push({ range: 'Renta General (SA/SRL)', rate: '25% Flat', amount: estimatedTax });
        }
    }

    const effectiveRate = taxableIncome > 0 ? (estimatedTax / taxableIncome) * 100 : 0;

    return {
        taxableIncome,
        estimatedTax,
        effectiveRate,
        brackets
    };
};
