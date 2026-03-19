import { AccountantTask } from '../types.ts';

/**
 * PANAMA DGI FISCAL CALCULATIONS
 */

/**
 * Liquidador de intereses moratorios (Panamá)
 * Rule: 10% annual interest (0.833% monthly approx or exactly per day if strictly following DGI)
 * For simplicity and common practice: (Amount * 0.10 * Days / 365)
 */
export const calculateLateInterest = (amount: number, dueDate: Date, paymentDate: Date): number => {
    if (paymentDate <= dueDate) return 0;

    const diffTime = Math.abs(paymentDate.getTime() - dueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // DGI Panama typically uses a 10% annual rate for moratory interest
    const annualRate = 0.10;
    const interest = amount * annualRate * (diffDays / 365);

    return parseFloat(interest.toFixed(2));
};

/**
 * Liquidador de sanción por extemporaneidad (Panamá)
 * Rules (Simplified for General Tax):
 * - If it's the first time: often $10.00 to $100.00 depending on tax.
 * - For ITBMS (Form 430): $10.00 per month or fraction.
 * - For Rent (Individual): $100.00 fixed initially.
 * - For Rent (Juridical): $500.00 fixed initially.
 */
export const calculateLatePenalty = (
    taxType: 'ITBMS' | 'ISR_NATURAL' | 'ISR_JURIDICO',
    monthsLate: number,
    isFirstTime: boolean = true
): number => {
    if (monthsLate <= 0) return 0;

    switch (taxType) {
        case 'ITBMS':
            // $10 por mes o fracción de mes de retraso
            return 10 * monthsLate;
        case 'ISR_NATURAL':
            // Sanción mínima $100
            return 100 + (isFirstTime ? 0 : 50 * monthsLate);
        case 'ISR_JURIDICO':
            // Sanción mínima $500
            return 500 + (isFirstTime ? 0 : 100 * monthsLate);
        default:
            return 0;
    }
};

/**
 * AI TASK PRIORITIZATION
 * Placeholder logic for sorting accountant tasks using weightage or AI
 */
export const prioritizeAccountantTasks = (tasks: AccountantTask[]): AccountantTask[] => {
    return [...tasks].sort((a, b) => {
        // 1. Priority weight
        const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const weightA = priorityWeight[a.priority];
        const weightB = priorityWeight[b.priority];

        if (weightA !== weightB) return weightB - weightA;

        // 2. Date weight
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
};
